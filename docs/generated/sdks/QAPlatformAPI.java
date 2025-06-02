/**
 * QA Platform API SDK for Java
 * 
 * Production-ready SDK with comprehensive error handling, retry logic, and rate limiting awareness
 * Version: 1.1.0
 */

package com.qaplatform.sdk;

import java.io.*;
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.core.JsonProcessingException;

/**
 * Main QA Platform API client class
 */
public class QAPlatformAPI {
    private static final String DEFAULT_BASE_URL = "http://localhost:3001/api/v1";
    private static final int DEFAULT_RETRY_ATTEMPTS = 3;
    private static final Duration DEFAULT_RETRY_DELAY = Duration.ofSeconds(1);
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);
    
    private final String apiKey;
    private String jwtToken;
    private final String baseUrl;
    private final int retryAttempts;
    private final Duration retryDelay;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    /**
     * Constructor with API key authentication
     */
    public QAPlatformAPI(String apiKey) {
        this(apiKey, null, DEFAULT_BASE_URL);
    }
    
    /**
     * Constructor with JWT token authentication
     */
    public QAPlatformAPI(String apiKey, String jwtToken, String baseUrl) {
        this(apiKey, jwtToken, baseUrl, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY, DEFAULT_TIMEOUT);
    }

    /**
     * Full constructor with all configuration options
     */
    public QAPlatformAPI(String apiKey, String jwtToken, String baseUrl, 
                        int retryAttempts, Duration retryDelay, Duration timeout) {
        if (apiKey == null && jwtToken == null) {
            throw new IllegalArgumentException("Either apiKey or jwtToken must be provided");
        }
        
        this.apiKey = apiKey;
        this.jwtToken = jwtToken;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.retryAttempts = retryAttempts;
        this.retryDelay = retryDelay;
        this.objectMapper = new ObjectMapper();
        
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(timeout)
            .build();
    }

    /**
     * Make a request to the API with retry logic
     */
    private ApiResponse request(String endpoint, String method, Object body, 
                               Map<String, String> queryParams) throws QAPlatformException {
        return requestWithRetry(endpoint, method, body, queryParams, 1);
    }

    private ApiResponse requestWithRetry(String endpoint, String method, Object body, 
                                       Map<String, String> queryParams, int attempt) throws QAPlatformException {
        try {
            URI uri = buildUri(endpoint, queryParams);
            
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json")
                .header("User-Agent", "QA-Platform-Java-SDK/1.1.0");

            // Add authentication headers
            if (jwtToken != null) {
                requestBuilder.header("Authorization", "Bearer " + jwtToken);
            } else if (apiKey != null) {
                requestBuilder.header("X-API-Key", apiKey);
            }

            // Set request method and body
            HttpRequest.BodyPublisher bodyPublisher = HttpRequest.BodyPublishers.noBody();
            if (body != null) {
                if (body instanceof String) {
                    bodyPublisher = HttpRequest.BodyPublishers.ofString((String) body);
                    requestBuilder.header("Content-Type", "application/json");
                } else {
                    String jsonBody = objectMapper.writeValueAsString(body);
                    bodyPublisher = HttpRequest.BodyPublishers.ofString(jsonBody);
                    requestBuilder.header("Content-Type", "application/json");
                }
            }

            HttpRequest request = requestBuilder.method(method, bodyPublisher).build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            // Handle rate limiting
            if (response.statusCode() == 429) {
                int retryAfter = parseRetryAfter(response.headers().firstValue("retry-after").orElse("60"));
                if (attempt <= retryAttempts) {
                    System.err.println("Rate limited. Retrying after " + retryAfter + " seconds...");
                    Thread.sleep(retryAfter * 1000L);
                    return requestWithRetry(endpoint, method, body, queryParams, attempt + 1);
                } else {
                    throw new RateLimitException("Rate limit exceeded and max retries reached", retryAfter);
                }
            }

            // Handle server errors with retry
            if (response.statusCode() >= 500 && attempt <= retryAttempts) {
                long delay = retryDelay.toMillis() * (long) Math.pow(2, attempt - 1);
                System.err.println("Server error (" + response.statusCode() + "). Retrying in " + delay + "ms...");
                Thread.sleep(delay);
                return requestWithRetry(endpoint, method, body, queryParams, attempt + 1);
            }

            // Handle authentication errors
            if (response.statusCode() == 401) {
                throw new AuthenticationException("Authentication failed");
            }

            // Handle other client errors
            if (response.statusCode() >= 400) {
                String errorMessage = "API Error (" + response.statusCode() + ")";
                try {
                    JsonNode errorJson = objectMapper.readTree(response.body());
                    JsonNode error = errorJson.get("error");
                    if (error != null && error.get("message") != null) {
                        errorMessage = error.get("message").asText();
                    }
                } catch (Exception e) {
                    // Use default error message
                }
                throw new QAPlatformException(errorMessage, response.statusCode());
            }

            return new ApiResponse(response.statusCode(), response.body());

        } catch (IOException | InterruptedException | JsonProcessingException e) {
            if (attempt <= retryAttempts && isRetryableError(e)) {
                long delay = retryDelay.toMillis() * (long) Math.pow(2, attempt - 1);
                System.err.println("Network error. Retrying in " + delay + "ms...");
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new QAPlatformException("Request interrupted", e);
                }
                return requestWithRetry(endpoint, method, body, queryParams, attempt + 1);
            }
            throw new QAPlatformException("Network error: " + e.getMessage(), e);
        }
    }

    private boolean isRetryableError(Exception e) {
        return e instanceof IOException || e instanceof InterruptedException;
    }

    private int parseRetryAfter(String retryAfter) {
        try {
            return Integer.parseInt(retryAfter);
        } catch (NumberFormatException e) {
            return 60; // Default to 60 seconds
        }
    }

    private URI buildUri(String endpoint, Map<String, String> queryParams) {
        StringBuilder uriBuilder = new StringBuilder(baseUrl + endpoint);
        
        if (queryParams != null && !queryParams.isEmpty()) {
            uriBuilder.append("?");
            queryParams.entrySet().stream()
                .filter(entry -> entry.getValue() != null)
                .forEach(entry -> uriBuilder.append(entry.getKey())
                    .append("=").append(entry.getValue()).append("&"));
            
            // Remove trailing &
            if (uriBuilder.charAt(uriBuilder.length() - 1) == '&') {
                uriBuilder.setLength(uriBuilder.length() - 1);
            }
        }
        
        return URI.create(uriBuilder.toString());
    }

    // Health and Status Methods
    public JsonNode healthCheck() throws QAPlatformException {
        ApiResponse response = request("/health", "GET", null, null);
        return parseResponse(response);
    }

    public JsonNode getVersion() throws QAPlatformException {
        ApiResponse response = request("/version", "GET", null, null);
        return parseResponse(response);
    }

    // Authentication Methods
    public JsonNode login(String email, String password) throws QAPlatformException {
        Map<String, String> loginData = new HashMap<>();
        loginData.put("email", email);
        loginData.put("password", password);
        
        ApiResponse response = request("/auth/login", "POST", loginData, null);
        JsonNode result = parseResponse(response);
        
        // Store JWT token if successful
        if (result.has("token")) {
            this.jwtToken = result.get("token").asText();
        }
        
        return result;
    }

    public JsonNode logout() throws QAPlatformException {
        ApiResponse response = request("/auth/logout", "POST", null, null);
        this.jwtToken = null;
        return parseResponse(response);
    }

    // API Key Management Methods
    public JsonNode getApiKeys(Map<String, String> filters) throws QAPlatformException {
        ApiResponse response = request("/api-keys", "GET", null, filters);
        return parseResponse(response);
    }

    public JsonNode createApiKey(Map<String, Object> keyData) throws QAPlatformException {
        ApiResponse response = request("/api-keys", "POST", keyData, null);
        return parseResponse(response);
    }

    public JsonNode getApiKey(String keyId) throws QAPlatformException {
        ApiResponse response = request("/api-keys/" + keyId, "GET", null, null);
        return parseResponse(response);
    }

    public JsonNode updateApiKey(String keyId, Map<String, Object> updates) throws QAPlatformException {
        ApiResponse response = request("/api-keys/" + keyId, "PATCH", updates, null);
        return parseResponse(response);
    }

    public JsonNode deleteApiKey(String keyId) throws QAPlatformException {
        ApiResponse response = request("/api-keys/" + keyId, "DELETE", null, null);
        return parseResponse(response);
    }

    // File Management Methods
    public JsonNode getFiles(Map<String, String> filters) throws QAPlatformException {
        ApiResponse response = request("/files", "GET", null, filters);
        return parseResponse(response);
    }

    public JsonNode uploadFile(Path filePath, FileUploadOptions options) throws QAPlatformException {
        return uploadFile(filePath.toFile(), options);
    }

    public JsonNode uploadFile(File file, FileUploadOptions options) throws QAPlatformException {
        try {
            if (!file.exists()) {
                throw new FileNotFoundException("File not found: " + file.getPath());
            }

            // Create multipart form data
            String boundary = "----QAPlatformBoundary" + System.currentTimeMillis();
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            
            // Add file
            outputStream.write(("--" + boundary + "\r\n").getBytes());
            outputStream.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + file.getName() + "\"\r\n").getBytes());
            outputStream.write("Content-Type: application/octet-stream\r\n\r\n".getBytes());
            outputStream.write(Files.readAllBytes(file.toPath()));
            outputStream.write("\r\n".getBytes());

            // Add options as form fields
            if (options != null) {
                if (options.getSourceLanguage() != null) {
                    addFormField(outputStream, boundary, "source_language", options.getSourceLanguage());
                }
                if (options.getTargetLanguage() != null) {
                    addFormField(outputStream, boundary, "target_language", options.getTargetLanguage());
                }
                if (options.getAssessmentModel() != null) {
                    addFormField(outputStream, boundary, "assessment_model", options.getAssessmentModel());
                }
                if (options.getPriority() != null) {
                    addFormField(outputStream, boundary, "priority", options.getPriority());
                }
            }

            outputStream.write(("--" + boundary + "--\r\n").getBytes());

            // Create request
            URI uri = buildUri("/files", null);
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofSeconds(60))
                .header("Accept", "application/json")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("User-Agent", "QA-Platform-Java-SDK/1.1.0");

            // Add authentication headers
            if (jwtToken != null) {
                requestBuilder.header("Authorization", "Bearer " + jwtToken);
            } else if (apiKey != null) {
                requestBuilder.header("X-API-Key", apiKey);
            }

            HttpRequest request = requestBuilder
                .POST(HttpRequest.BodyPublishers.ofByteArray(outputStream.toByteArray()))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new QAPlatformException("Upload failed: " + response.body(), response.statusCode());
            }

            return objectMapper.readTree(response.body());

        } catch (IOException | InterruptedException e) {
            throw new QAPlatformException("File upload error: " + e.getMessage(), e);
        }
    }

    private void addFormField(ByteArrayOutputStream outputStream, String boundary, String name, String value) throws IOException {
        outputStream.write(("--" + boundary + "\r\n").getBytes());
        outputStream.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes());
        outputStream.write(value.getBytes());
        outputStream.write("\r\n".getBytes());
    }

    public JsonNode getFile(String fileId) throws QAPlatformException {
        ApiResponse response = request("/files/" + fileId, "GET", null, null);
        return parseResponse(response);
    }

    public JsonNode deleteFile(String fileId) throws QAPlatformException {
        ApiResponse response = request("/files/" + fileId, "DELETE", null, null);
        return parseResponse(response);
    }

    // Quality Assessment Methods
    public JsonNode getAssessments(String fileId, Map<String, String> options) throws QAPlatformException {
        ApiResponse response = request("/files/" + fileId + "/assessments", "GET", null, options);
        return parseResponse(response);
    }

    public JsonNode createAssessment(String fileId, Map<String, Object> assessmentData) throws QAPlatformException {
        ApiResponse response = request("/files/" + fileId + "/assessments", "POST", assessmentData, null);
        return parseResponse(response);
    }

    public JsonNode getAssessment(String fileId, String assessmentId) throws QAPlatformException {
        ApiResponse response = request("/files/" + fileId + "/assessments/" + assessmentId, "GET", null, null);
        return parseResponse(response);
    }

    // Utility Methods
    public List<JsonNode> paginate(String endpoint, Map<String, String> options) throws QAPlatformException {
        List<JsonNode> results = new ArrayList<>();
        int offset = 0;
        int limit = options != null && options.containsKey("limit") ? 
            Integer.parseInt(options.get("limit")) : 20;
        
        while (true) {
            Map<String, String> params = new HashMap<>(options != null ? options : new HashMap<>());
            params.put("limit", String.valueOf(limit));
            params.put("offset", String.valueOf(offset));
            
            JsonNode response = parseResponse(request(endpoint, "GET", null, params));
            
            if (response.has("data") && response.get("data").isArray() && response.get("data").size() > 0) {
                for (JsonNode item : response.get("data")) {
                    results.add(item);
                }
                offset += limit;
                
                // Check if we've reached the end
                if (response.get("data").size() < limit || 
                    (response.has("pagination") && 
                     response.get("pagination").has("total") &&
                     offset >= response.get("pagination").get("total").asInt())) {
                    break;
                }
            } else {
                break;
            }
        }
        
        return results;
    }

    // Webhook Validation
    public static boolean validateWebhookSignature(byte[] payload, String signature, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
            mac.init(secretKeySpec);
            
            byte[] expectedSignature = mac.doFinal(payload);
            byte[] providedSignature = signature.getBytes();
            
            return Arrays.equals(expectedSignature, providedSignature);
        } catch (Exception e) {
            return false;
        }
    }

    private JsonNode parseResponse(ApiResponse response) throws QAPlatformException {
        try {
            return objectMapper.readTree(response.getBody());
        } catch (JsonProcessingException e) {
            throw new QAPlatformException("Failed to parse response: " + e.getMessage(), e);
        }
    }

    // Inner Classes and Data Models
    public static class FileUploadOptions {
        private String sourceLanguage;
        private String targetLanguage;
        private String assessmentModel = "gpt-4";
        private String priority = "normal";
        private Boolean autoProcess = true;
        private String webhookUrl;

        // Constructors
        public FileUploadOptions() {}

        public FileUploadOptions(String sourceLanguage, String targetLanguage) {
            this.sourceLanguage = sourceLanguage;
            this.targetLanguage = targetLanguage;
        }

        // Getters and Setters
        public String getSourceLanguage() { return sourceLanguage; }
        public void setSourceLanguage(String sourceLanguage) { this.sourceLanguage = sourceLanguage; }

        public String getTargetLanguage() { return targetLanguage; }
        public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }

        public String getAssessmentModel() { return assessmentModel; }
        public void setAssessmentModel(String assessmentModel) { this.assessmentModel = assessmentModel; }

        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }

        public Boolean getAutoProcess() { return autoProcess; }
        public void setAutoProcess(Boolean autoProcess) { this.autoProcess = autoProcess; }

        public String getWebhookUrl() { return webhookUrl; }
        public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }
    }

    private static class ApiResponse {
        private final int statusCode;
        private final String body;

        public ApiResponse(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }

        public int getStatusCode() { return statusCode; }
        public String getBody() { return body; }
    }

    // Exception Classes
    public static class QAPlatformException extends Exception {
        private final int statusCode;

        public QAPlatformException(String message) {
            super(message);
            this.statusCode = 0;
        }

        public QAPlatformException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        public QAPlatformException(String message, Throwable cause) {
            super(message, cause);
            this.statusCode = 0;
        }

        public int getStatusCode() { return statusCode; }
    }

    public static class RateLimitException extends QAPlatformException {
        private final int retryAfter;

        public RateLimitException(String message, int retryAfter) {
            super(message, 429);
            this.retryAfter = retryAfter;
        }

        public int getRetryAfter() { return retryAfter; }
    }

    public static class AuthenticationException extends QAPlatformException {
        public AuthenticationException(String message) {
            super(message, 401);
        }
    }

    // Factory Methods
    public static QAPlatformAPI forEnvironment(String apiKey, String environment) {
        Map<String, String> baseUrls = Map.of(
            "development", "http://localhost:3001/api/v1",
            "staging", "https://staging-api.qa-platform.com/v1",
            "production", "https://api.qa-platform.com/v1"
        );
        
        String baseUrl = baseUrls.getOrDefault(environment, baseUrls.get("development"));
        return new QAPlatformAPI(apiKey, null, baseUrl);
    }

    // Example Usage in Main Method
    public static void main(String[] args) {
        try {
            // Create API client
            QAPlatformAPI api = QAPlatformAPI.forEnvironment("your-api-key", "development");
            
            // Check health
            JsonNode health = api.healthCheck();
            System.out.println("API Health: " + health);
            
            // Upload a file
            FileUploadOptions options = new FileUploadOptions("en", "fr");
            options.setAssessmentModel("gpt-4");
            options.setPriority("high");
            
            // JsonNode result = api.uploadFile(new File("path/to/file.xliff"), options);
            // System.out.println("Upload result: " + result);
            
            // Get all files with pagination
            List<JsonNode> allFiles = api.paginate("/files", Map.of("status", "completed"));
            System.out.println("Found " + allFiles.size() + " completed files");
            
        } catch (RateLimitException e) {
            System.err.println("Rate limited. Retry after " + e.getRetryAfter() + " seconds");
        } catch (AuthenticationException e) {
            System.err.println("Authentication failed: " + e.getMessage());
        } catch (QAPlatformException e) {
            System.err.println("API Error: " + e.getMessage() + " (Status: " + e.getStatusCode() + ")");
        } catch (Exception e) {
            System.err.println("Unexpected error: " + e.getMessage());
        }
    }
} 