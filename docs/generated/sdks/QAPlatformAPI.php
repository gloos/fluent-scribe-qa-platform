<?php
/**
 * QA Platform API SDK for PHP
 * 
 * Production-ready SDK with comprehensive error handling, retry logic, and rate limiting awareness
 * Version: 1.1.0
 */

declare(strict_types=1);

namespace QAPlatform\SDK;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\RequestOptions;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Custom exceptions for better error handling
 */
class QAPlatformException extends \Exception
{
    protected int $statusCode;
    protected ?string $errorCode;
    protected array $details;

    public function __construct(
        string $message = '',
        int $statusCode = 0,
        ?string $errorCode = null,
        array $details = [],
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $statusCode, $previous);
        $this->statusCode = $statusCode;
        $this->errorCode = $errorCode;
        $this->details = $details;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function getDetails(): array
    {
        return $this->details;
    }
}

class RateLimitException extends QAPlatformException
{
    private int $retryAfter;

    public function __construct(string $message = 'Rate limit exceeded', int $retryAfter = 60)
    {
        parent::__construct($message, 429, 'rate_limit_exceeded');
        $this->retryAfter = $retryAfter;
    }

    public function getRetryAfter(): int
    {
        return $this->retryAfter;
    }
}

class AuthenticationException extends QAPlatformException
{
    public function __construct(string $message = 'Authentication failed')
    {
        parent::__construct($message, 401, 'authentication_failed');
    }
}

/**
 * File upload options class
 */
class FileUploadOptions
{
    public ?string $sourceLanguage = null;
    public ?string $targetLanguage = null;
    public string $assessmentModel = 'gpt-4';
    public string $priority = 'normal';
    public bool $autoProcess = true;
    public ?string $webhookUrl = null;

    public function __construct(
        ?string $sourceLanguage = null,
        ?string $targetLanguage = null
    ) {
        $this->sourceLanguage = $sourceLanguage;
        $this->targetLanguage = $targetLanguage;
    }

    public function toArray(): array
    {
        return array_filter([
            'source_language' => $this->sourceLanguage,
            'target_language' => $this->targetLanguage,
            'assessment_model' => $this->assessmentModel,
            'priority' => $this->priority,
            'auto_process' => $this->autoProcess ? 'true' : 'false',
            'webhook_url' => $this->webhookUrl,
        ], fn($value) => $value !== null);
    }
}

/**
 * Main QA Platform API client class
 */
class QAPlatformAPI
{
    private const DEFAULT_BASE_URL = 'http://localhost:3001/api/v1';
    private const DEFAULT_RETRY_ATTEMPTS = 3;
    private const DEFAULT_RETRY_DELAY = 1.0; // seconds
    private const DEFAULT_TIMEOUT = 30.0; // seconds

    private ?string $apiKey;
    private ?string $jwtToken;
    private string $baseUrl;
    private int $retryAttempts;
    private float $retryDelay;
    private float $timeout;
    private Client $client;
    private LoggerInterface $logger;

    /**
     * Constructor
     */
    public function __construct(
        ?string $apiKey = null,
        ?string $jwtToken = null,
        string $baseUrl = self::DEFAULT_BASE_URL,
        int $retryAttempts = self::DEFAULT_RETRY_ATTEMPTS,
        float $retryDelay = self::DEFAULT_RETRY_DELAY,
        float $timeout = self::DEFAULT_TIMEOUT,
        ?LoggerInterface $logger = null
    ) {
        if ($apiKey === null && $jwtToken === null) {
            throw new \InvalidArgumentException('Either apiKey or jwtToken must be provided');
        }

        $this->apiKey = $apiKey;
        $this->jwtToken = $jwtToken;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->retryAttempts = $retryAttempts;
        $this->retryDelay = $retryDelay;
        $this->timeout = $timeout;
        $this->logger = $logger ?? new NullLogger();

        $this->initializeClient();
    }

    /**
     * Initialize the HTTP client with retry middleware
     */
    private function initializeClient(): void
    {
        $stack = HandlerStack::create();
        
        // Add retry middleware
        $stack->push(Middleware::retry(
            function (int $retries, RequestInterface $request, ?ResponseInterface $response = null, ?RequestException $exception = null): bool {
                if ($retries >= $this->retryAttempts) {
                    return false;
                }

                // Retry on network errors
                if ($exception && !$response) {
                    $this->logger->warning('Network error, retrying...', [
                        'attempt' => $retries + 1,
                        'error' => $exception->getMessage()
                    ]);
                    return true;
                }

                // Retry on server errors (5xx)
                if ($response && $response->getStatusCode() >= 500) {
                    $this->logger->warning('Server error, retrying...', [
                        'attempt' => $retries + 1,
                        'status' => $response->getStatusCode()
                    ]);
                    return true;
                }

                return false;
            },
            function (int $retries): float {
                return $this->retryDelay * (2 ** $retries); // Exponential backoff
            }
        ));

        $this->client = new Client([
            'handler' => $stack,
            'timeout' => $this->timeout,
            'headers' => [
                'User-Agent' => 'QA-Platform-PHP-SDK/1.1.0',
                'Accept' => 'application/json',
            ],
        ]);
    }

    /**
     * Get authentication headers
     */
    private function getAuthHeaders(): array
    {
        if ($this->jwtToken) {
            return ['Authorization' => 'Bearer ' . $this->jwtToken];
        }

        if ($this->apiKey) {
            return ['X-API-Key' => $this->apiKey];
        }

        return [];
    }

    /**
     * Make a request to the API with retry logic
     */
    private function request(
        string $method,
        string $endpoint,
        array $options = []
    ): array {
        $url = $this->baseUrl . $endpoint;
        
        // Merge auth headers
        $options['headers'] = array_merge(
            $options['headers'] ?? [],
            $this->getAuthHeaders()
        );

        try {
            $response = $this->client->request($method, $url, $options);
            
            // Handle rate limiting
            if ($response->getStatusCode() === 429) {
                $retryAfter = (int) $response->getHeaderLine('retry-after') ?: 60;
                throw new RateLimitException('Rate limit exceeded', $retryAfter);
            }

            $body = (string) $response->getBody();
            $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);

            return $data;

        } catch (RequestException $e) {
            $response = $e->getResponse();
            
            if ($response) {
                $statusCode = $response->getStatusCode();
                
                // Handle rate limiting
                if ($statusCode === 429) {
                    $retryAfter = (int) $response->getHeaderLine('retry-after') ?: 60;
                    throw new RateLimitException('Rate limit exceeded', $retryAfter);
                }

                // Handle authentication errors
                if ($statusCode === 401) {
                    throw new AuthenticationException('Authentication failed');
                }

                // Parse error response
                try {
                    $body = (string) $response->getBody();
                    $errorData = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
                    $error = $errorData['error'] ?? [];
                    
                    throw new QAPlatformException(
                        $error['message'] ?? 'API Error',
                        $statusCode,
                        $error['code'] ?? null,
                        $error['details'] ?? []
                    );
                } catch (\JsonException $jsonError) {
                    throw new QAPlatformException(
                        'API Error (' . $statusCode . ')',
                        $statusCode
                    );
                }
            }

            throw new QAPlatformException(
                'Network error: ' . $e->getMessage(),
                0,
                null,
                [],
                $e
            );
        } catch (\JsonException $e) {
            throw new QAPlatformException(
                'Failed to parse response: ' . $e->getMessage(),
                0,
                null,
                [],
                $e
            );
        }
    }

    // Health and Status Methods
    public function healthCheck(): array
    {
        return $this->request('GET', '/health');
    }

    public function getVersion(): array
    {
        return $this->request('GET', '/version');
    }

    // Authentication Methods
    public function login(string $email, string $password): array
    {
        $response = $this->request('POST', '/auth/login', [
            'json' => [
                'email' => $email,
                'password' => $password,
            ],
        ]);

        // Store JWT token if successful
        if (isset($response['token'])) {
            $this->jwtToken = $response['token'];
            $this->apiKey = null; // Prefer JWT over API key
        }

        return $response;
    }

    public function logout(): array
    {
        $response = $this->request('POST', '/auth/logout');
        $this->jwtToken = null;
        return $response;
    }

    // API Key Management Methods
    public function getApiKeys(array $filters = []): array
    {
        return $this->request('GET', '/api-keys', [
            'query' => array_filter($filters)
        ]);
    }

    public function createApiKey(array $keyData): array
    {
        return $this->request('POST', '/api-keys', [
            'json' => $keyData
        ]);
    }

    public function getApiKey(string $keyId): array
    {
        return $this->request('GET', "/api-keys/{$keyId}");
    }

    public function updateApiKey(string $keyId, array $updates): array
    {
        return $this->request('PATCH', "/api-keys/{$keyId}", [
            'json' => $updates
        ]);
    }

    public function deleteApiKey(string $keyId): array
    {
        return $this->request('DELETE', "/api-keys/{$keyId}");
    }

    // File Management Methods
    public function getFiles(array $filters = []): array
    {
        return $this->request('GET', '/files', [
            'query' => array_filter($filters, fn($value) => $value !== null)
        ]);
    }

    public function uploadFile(string $filePath, ?FileUploadOptions $options = null): array
    {
        if (!file_exists($filePath)) {
            throw new \InvalidArgumentException("File not found: {$filePath}");
        }

        $multipart = [
            [
                'name' => 'file',
                'contents' => fopen($filePath, 'r'),
                'filename' => basename($filePath),
            ],
        ];

        // Add options as form fields
        if ($options) {
            foreach ($options->toArray() as $name => $value) {
                if ($value !== null) {
                    $multipart[] = [
                        'name' => $name,
                        'contents' => (string) $value,
                    ];
                }
            }
        }

        return $this->request('POST', '/files', [
            'multipart' => $multipart,
            'headers' => array_merge(
                $this->getAuthHeaders(),
                ['Accept' => 'application/json']
            )
        ]);
    }

    public function uploadFileFromResource($resource, string $filename, ?FileUploadOptions $options = null): array
    {
        if (!is_resource($resource)) {
            throw new \InvalidArgumentException('First parameter must be a resource');
        }

        $multipart = [
            [
                'name' => 'file',
                'contents' => $resource,
                'filename' => $filename,
            ],
        ];

        // Add options as form fields
        if ($options) {
            foreach ($options->toArray() as $name => $value) {
                if ($value !== null) {
                    $multipart[] = [
                        'name' => $name,
                        'contents' => (string) $value,
                    ];
                }
            }
        }

        return $this->request('POST', '/files', [
            'multipart' => $multipart,
            'headers' => array_merge(
                $this->getAuthHeaders(),
                ['Accept' => 'application/json']
            )
        ]);
    }

    public function getFile(string $fileId): array
    {
        return $this->request('GET', "/files/{$fileId}");
    }

    public function deleteFile(string $fileId): array
    {
        return $this->request('DELETE', "/files/{$fileId}");
    }

    // Quality Assessment Methods
    public function getAssessments(string $fileId, array $options = []): array
    {
        return $this->request('GET', "/files/{$fileId}/assessments", [
            'query' => $options
        ]);
    }

    public function createAssessment(string $fileId, array $assessmentData): array
    {
        return $this->request('POST', "/files/{$fileId}/assessments", [
            'json' => $assessmentData
        ]);
    }

    public function getAssessment(string $fileId, string $assessmentId): array
    {
        return $this->request('GET', "/files/{$fileId}/assessments/{$assessmentId}");
    }

    // Utility Methods
    public function paginate(string $endpoint, array $options = []): array
    {
        $results = [];
        $offset = 0;
        $limit = (int) ($options['limit'] ?? 20);
        
        // Remove limit from options to avoid duplication
        unset($options['limit']);

        while (true) {
            $params = array_merge($options, [
                'limit' => $limit,
                'offset' => $offset,
            ]);

            $response = $this->request('GET', $endpoint, [
                'query' => $params
            ]);

            if (isset($response['data']) && is_array($response['data']) && !empty($response['data'])) {
                $results = array_merge($results, $response['data']);
                $offset += $limit;

                // Check if we've reached the end
                if (count($response['data']) < $limit ||
                    (isset($response['pagination']['total']) && $offset >= $response['pagination']['total'])) {
                    break;
                }
            } else {
                break;
            }
        }

        return $results;
    }

    // Webhook Validation
    public static function validateWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        return hash_equals($expectedSignature, $signature);
    }

    // Factory Methods
    public static function forEnvironment(string $apiKey, string $environment = 'development'): self
    {
        $baseUrls = [
            'development' => 'http://localhost:3001/api/v1',
            'staging' => 'https://staging-api.qa-platform.com/v1',
            'production' => 'https://api.qa-platform.com/v1',
        ];

        $baseUrl = $baseUrls[$environment] ?? $baseUrls['development'];

        return new self($apiKey, null, $baseUrl);
    }

    public static function withJWT(string $jwtToken, string $baseUrl = self::DEFAULT_BASE_URL): self
    {
        return new self(null, $jwtToken, $baseUrl);
    }

    // Configuration Methods
    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
        $this->jwtToken = null;
    }

    public function setJwtToken(string $jwtToken): void
    {
        $this->jwtToken = $jwtToken;
        $this->apiKey = null;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function setTimeout(float $timeout): void
    {
        $this->timeout = $timeout;
        $this->initializeClient(); // Reinitialize with new timeout
    }

    public function setRetryAttempts(int $retryAttempts): void
    {
        $this->retryAttempts = $retryAttempts;
        $this->initializeClient(); // Reinitialize with new retry settings
    }
}

// Example usage and testing
if (basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    try {
        // Create API client
        $api = QAPlatformAPI::forEnvironment('your-api-key', 'development');

        // Check health
        $health = $api->healthCheck();
        echo "API Health: " . json_encode($health, JSON_PRETTY_PRINT) . "\n";

        // Upload a file
        $options = new FileUploadOptions('en', 'fr');
        $options->assessmentModel = 'gpt-4';
        $options->priority = 'high';

        // Uncomment to test file upload
        // $result = $api->uploadFile('path/to/file.xliff', $options);
        // echo "Upload result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";

        // Get all files with pagination
        $allFiles = $api->paginate('/files', ['status' => 'completed']);
        echo "Found " . count($allFiles) . " completed files\n";

    } catch (RateLimitException $e) {
        echo "Rate limited. Retry after {$e->getRetryAfter()} seconds\n";
    } catch (AuthenticationException $e) {
        echo "Authentication failed: {$e->getMessage()}\n";
    } catch (QAPlatformException $e) {
        echo "API Error: {$e->getMessage()} (Code: {$e->getErrorCode()}, Status: {$e->getStatusCode()})\n";
        if (!empty($e->getDetails())) {
            echo "Details: " . json_encode($e->getDetails()) . "\n";
        }
    } catch (\Exception $e) {
        echo "Unexpected error: {$e->getMessage()}\n";
    }
}
?> 