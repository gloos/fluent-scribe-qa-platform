"""
QA Platform API SDK for Python

Production-ready SDK with comprehensive error handling, retry logic, and rate limiting awareness
Version: 1.1.0
"""

import requests
import json
import time
import hashlib
import hmac
from typing import Dict, Any, Optional, List, Union, IO
from urllib.parse import urlencode
import logging
from dataclasses import dataclass
from pathlib import Path


# Custom exceptions for better error handling
class QAPlatformError(Exception):
    """Base exception for QA Platform API errors."""
    
    def __init__(self, message: str, status_code: int = None, error_code: str = None, details: List[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or []


class RateLimitError(QAPlatformError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, message: str, retry_after: int = 60):
        super().__init__(message, 429, 'rate_limit_exceeded')
        self.retry_after = retry_after


class AuthenticationError(QAPlatformError):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401, 'authentication_failed')


@dataclass
class FileUploadOptions:
    """Options for file upload."""
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    assessment_model: Optional[str] = 'gpt-4'
    priority: Optional[str] = 'normal'
    auto_process: Optional[bool] = True
    webhook_url: Optional[str] = None


class QAPlatformAPI:
    """
    Production-ready QA Platform API client with comprehensive error handling,
    retry logic, and rate limiting awareness.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        jwt_token: Optional[str] = None,
        base_url: str = "http://localhost:3001/api/v1",
        retry_attempts: int = 3,
        retry_delay: float = 1.0,
        timeout: int = 30,
        logger: Optional[logging.Logger] = None
    ):
        """
        Initialize the QA Platform API client.
        
        Args:
            api_key: API key for authentication
            jwt_token: JWT token for authentication (preferred over API key)
            base_url: Base URL for the API
            retry_attempts: Number of retry attempts for failed requests
            retry_delay: Initial delay between retries (with exponential backoff)
            timeout: Request timeout in seconds
            logger: Custom logger instance
        """
        if not api_key and not jwt_token:
            raise ValueError("Either api_key or jwt_token must be provided")
        
        self.api_key = api_key
        self.jwt_token = jwt_token
        self.base_url = base_url.rstrip('/')
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.timeout = timeout
        self.logger = logger or self._setup_logger()
        
        self.session = requests.Session()
        self._update_auth_headers()

    def _setup_logger(self) -> logging.Logger:
        """Set up a default logger."""
        logger = logging.getLogger('qa_platform_sdk')
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.WARNING)
        return logger

    def _update_auth_headers(self):
        """Update session headers with authentication."""
        self.session.headers.clear()
        self.session.headers.update({
            'User-Agent': 'QA-Platform-Python-SDK/1.1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
        
        if self.jwt_token:
            self.session.headers['Authorization'] = f'Bearer {self.jwt_token}'
        elif self.api_key:
            self.session.headers['X-API-Key'] = self.api_key

    def request(
        self, 
        endpoint: str, 
        method: str = 'GET', 
        params: Dict[str, Any] = None,
        json_data: Dict[str, Any] = None,
        files: Dict[str, Any] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make a request to the API with retry logic and error handling.
        
        Args:
            endpoint: API endpoint path
            method: HTTP method
            params: Query parameters
            json_data: JSON data for request body
            files: Files for multipart upload
            **kwargs: Additional arguments passed to requests
        
        Returns:
            API response as dictionary
        
        Raises:
            QAPlatformError: For API errors
            RateLimitError: For rate limit errors
            AuthenticationError: For authentication errors
        """
        url = f"{self.base_url}{endpoint}"
        
        for attempt in range(1, self.retry_attempts + 1):
            try:
                # Prepare request arguments
                request_kwargs = {
                    'timeout': self.timeout,
                    'params': params,
                    **kwargs
                }
                
                if files:
                    # Remove Content-Type for multipart requests
                    headers = self.session.headers.copy()
                    if 'Content-Type' in headers:
                        del headers['Content-Type']
                    request_kwargs['headers'] = headers
                    request_kwargs['files'] = files
                elif json_data:
                    request_kwargs['json'] = json_data
                
                response = self.session.request(method, url, **request_kwargs)
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('retry-after', 60))
                    if attempt <= self.retry_attempts:
                        self.logger.warning(f"Rate limited. Retrying after {retry_after} seconds...")
                        time.sleep(retry_after)
                        continue
                    else:
                        raise RateLimitError(
                            "Rate limit exceeded and max retries reached",
                            retry_after
                        )
                
                # Handle server errors with retry
                if response.status_code >= 500 and attempt <= self.retry_attempts:
                    delay = self.retry_delay * (2 ** (attempt - 1))
                    self.logger.warning(f"Server error ({response.status_code}). Retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                
                # Handle authentication errors
                if response.status_code == 401:
                    try:
                        error_data = response.json()
                        message = error_data.get('error', {}).get('message', 'Authentication failed')
                    except ValueError:
                        message = 'Authentication failed'
                    raise AuthenticationError(message)
                
                # Handle other client errors
                if not response.ok:
                    try:
                        error_data = response.json()
                        error_info = error_data.get('error', {})
                        message = error_info.get('message', 'Unknown error')
                        code = error_info.get('code')
                        details = error_info.get('details', [])
                    except ValueError:
                        message = response.text or 'Unknown error'
                        code = None
                        details = []
                    
                    raise QAPlatformError(
                        message,
                        response.status_code,
                        code,
                        details
                    )
                
                return response.json()
                
            except requests.exceptions.RequestException as e:
                if attempt <= self.retry_attempts and self._is_retryable_error(e):
                    delay = self.retry_delay * (2 ** (attempt - 1))
                    self.logger.warning(f"Network error. Retrying in {delay}s...")
                    time.sleep(delay)
                    continue
                raise QAPlatformError(f"Network error: {str(e)}")
        
        raise QAPlatformError("Max retries exceeded")

    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if an error is retryable."""
        retryable_errors = (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.HTTPError
        )
        return isinstance(error, retryable_errors)

    # Health and Status
    def health_check(self) -> Dict[str, Any]:
        """Check API health status."""
        return self.request('/health')

    def get_version(self) -> Dict[str, Any]:
        """Get API version information."""
        return self.request('/version')

    # Authentication
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate with email and password.
        
        Args:
            email: User email
            password: User password
        
        Returns:
            Authentication response with token
        """
        response = self.request('/auth/login', method='POST', json_data={
            'email': email,
            'password': password
        })
        
        # Store JWT token if successful
        if 'token' in response:
            self.jwt_token = response['token']
            self.api_key = None  # Prefer JWT over API key
            self._update_auth_headers()
        
        return response

    def logout(self) -> Dict[str, Any]:
        """Logout and invalidate current session."""
        response = self.request('/auth/logout', method='POST')
        self.jwt_token = None
        self._update_auth_headers()
        return response

    # API Key Management
    def get_api_keys(self, **filters) -> Dict[str, Any]:
        """Get list of API keys with optional filters."""
        return self.request('/api-keys', params=filters)

    def create_api_key(self, key_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new API key."""
        return self.request('/api-keys', method='POST', json_data=key_data)

    def get_api_key(self, key_id: str) -> Dict[str, Any]:
        """Get specific API key by ID."""
        return self.request(f'/api-keys/{key_id}')

    def update_api_key(self, key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing API key."""
        return self.request(f'/api-keys/{key_id}', method='PATCH', json_data=updates)

    def delete_api_key(self, key_id: str) -> Dict[str, Any]:
        """Delete an API key."""
        return self.request(f'/api-keys/{key_id}', method='DELETE')

    # File Management
    def get_files(self, **filters) -> Dict[str, Any]:
        """
        Get list of files with optional filters.
        
        Args:
            **filters: Optional filters (status, file_type, limit, offset, etc.)
        
        Returns:
            List of files with metadata
        """
        # Remove None values from filters
        clean_filters = {k: v for k, v in filters.items() if v is not None}
        return self.request('/files', params=clean_filters)

    def upload_file(
        self, 
        file_path: Union[str, Path, IO], 
        options: Optional[FileUploadOptions] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Upload a file for processing.
        
        Args:
            file_path: Path to file, file object, or file-like object
            options: Upload options (languages, model, etc.)
            **kwargs: Additional form data
        
        Returns:
            Upload response with file metadata
        """
        if isinstance(file_path, (str, Path)):
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'application/octet-stream')}
                return self._upload_with_files(files, options, kwargs)
        else:
            # Assume file-like object
            filename = getattr(file_path, 'name', 'uploaded_file')
            files = {'file': (filename, file_path, 'application/octet-stream')}
            return self._upload_with_files(files, options, kwargs)

    def _upload_with_files(
        self, 
        files: Dict[str, Any], 
        options: Optional[FileUploadOptions], 
        extra_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Helper method to upload files with form data."""
        data = {}
        
        # Add options to form data
        if options:
            for field, value in options.__dict__.items():
                if value is not None:
                    data[field] = str(value)
        
        # Add extra data
        data.update({k: str(v) for k, v in extra_data.items() if v is not None})
        
        return self.request('/files', method='POST', files=files, data=data)

    def get_file(self, file_id: str) -> Dict[str, Any]:
        """Get specific file by ID."""
        return self.request(f'/files/{file_id}')

    def delete_file(self, file_id: str) -> Dict[str, Any]:
        """Delete a file."""
        return self.request(f'/files/{file_id}', method='DELETE')

    # Quality Assessment endpoints
    def get_assessments(self, file_id: str, **options) -> Dict[str, Any]:
        """Get quality assessments for a file."""
        return self.request(f'/files/{file_id}/assessments', params=options)

    def create_assessment(self, file_id: str, assessment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new quality assessment."""
        return self.request(
            f'/files/{file_id}/assessments',
            method='POST',
            json_data=assessment_data
        )

    def get_assessment(self, file_id: str, assessment_id: str) -> Dict[str, Any]:
        """Get specific assessment by ID."""
        return self.request(f'/files/{file_id}/assessments/{assessment_id}')

    # Utility methods
    def paginate(self, endpoint: str, **options) -> List[Dict[str, Any]]:
        """
        Paginate through all results for an endpoint.
        
        Args:
            endpoint: API endpoint to paginate
            **options: Additional parameters
        
        Returns:
            List of all results
        """
        results = []
        offset = 0
        limit = options.pop('limit', 20)
        
        while True:
            params = {**options, 'limit': limit, 'offset': offset}
            response = self.request(endpoint, params=params)
            
            if 'data' in response and response['data']:
                results.extend(response['data'])
                offset += limit
                
                # Check if we've reached the end
                if (len(response['data']) < limit or 
                    (response.get('pagination', {}).get('total', 0) <= offset)):
                    break
            else:
                break
        
        return results

    # Webhook helpers
    @staticmethod
    def validate_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
        """
        Validate webhook signature.
        
        Args:
            payload: Raw webhook payload
            signature: Signature from webhook headers
            secret: Webhook secret
        
        Returns:
            True if signature is valid
        """
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)


# Example usage and factory functions
def create_api_client(
    api_key: Optional[str] = None,
    jwt_token: Optional[str] = None,
    environment: str = 'development'
) -> QAPlatformAPI:
    """
    Factory function to create API client with environment-specific settings.
    
    Args:
        api_key: API key for authentication
        jwt_token: JWT token for authentication
        environment: Environment ('development', 'staging', 'production')
    
    Returns:
        Configured QAPlatformAPI instance
    """
    base_urls = {
        'development': 'http://localhost:3001/api/v1',
        'staging': 'https://staging-api.qa-platform.com/v1',
        'production': 'https://api.qa-platform.com/v1'
    }
    
    return QAPlatformAPI(
        api_key=api_key,
        jwt_token=jwt_token,
        base_url=base_urls.get(environment, base_urls['development'])
    )


if __name__ == "__main__":
    # Example usage
    try:
        # Create API client
        api = create_api_client(api_key='your-api-key')
        
        # Check health
        health = api.health_check()
        print(f"API Health: {health}")
        
        # Upload a file
        upload_options = FileUploadOptions(
            source_language='en',
            target_language='fr',
            assessment_model='gpt-4',
            priority='high'
        )
        
        # result = api.upload_file('path/to/file.xliff', upload_options)
        # print(f"Upload result: {result}")
        
        # Get all files with pagination
        all_files = api.paginate('/files', status='completed')
        print(f"Found {len(all_files)} completed files")
        
    except RateLimitError as e:
        print(f"Rate limited. Retry after {e.retry_after} seconds")
    except AuthenticationError as e:
        print(f"Authentication failed: {e}")
    except QAPlatformError as e:
        print(f"API Error: {e} (Code: {e.error_code})")
    except Exception as e:
        print(f"Unexpected error: {e}")
