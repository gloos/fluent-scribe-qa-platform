# Complete Translation QA Workflow

This example demonstrates a complete translation QA workflow from file upload to report generation, including proper error handling, status monitoring, and result retrieval.

## Scenario

You have translation files (XLIFF format) that need quality assessment. This workflow will:
1. Authenticate with the API
2. Upload XLIFF files for processing
3. Monitor processing status
4. Create quality assessments
5. Retrieve and download reports
6. Handle errors and rate limiting

## Prerequisites

- API key or user credentials
- XLIFF files to process
- Understanding of target languages and quality dimensions

---

## JavaScript/Node.js Implementation

### Setup and Dependencies

```javascript
// package.json dependencies
{
  "node-fetch": "^3.3.0",
  "form-data": "^4.0.0",
  "fs": "^0.0.1-security"
}

// Import required modules
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
```

### Complete Workflow Class

```javascript
class TranslationQAWorkflow {
  constructor(apiKey, baseUrl = 'https://api.qa-platform.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  // Robust API request method with retry logic
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'X-API-Key': this.apiKey,
        ...options.headers
      },
      ...options
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after')) || 60;
          console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        return await response.json();

      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Step 1: Upload XLIFF file
  async uploadFile(filePath, options = {}) {
    console.log(`Uploading file: ${filePath}`);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('source_language', options.sourceLanguage || 'en');
    formData.append('target_language', options.targetLanguage || 'fr');
    formData.append('assessment_model', options.model || 'gpt-4');
    formData.append('priority', options.priority || 'normal');

    const result = await this.apiRequest('/files', {
      method: 'POST',
      body: formData,
      headers: {} // Let FormData set the Content-Type
    });

    console.log(`File uploaded successfully. File ID: ${result.file_id}`);
    return result;
  }

  // Step 2: Monitor file processing status
  async waitForProcessing(fileId, maxWaitTime = 300000) { // 5 minutes max
    console.log(`Monitoring processing status for file: ${fileId}`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const fileInfo = await this.apiRequest(`/files/${fileId}`);
      
      console.log(`Processing status: ${fileInfo.processing_status}`);
      
      switch (fileInfo.processing_status) {
        case 'completed':
          console.log('File processing completed successfully');
          return fileInfo;
        
        case 'failed':
          throw new Error(`File processing failed: ${fileInfo.error_message}`);
        
        case 'processing':
        case 'uploaded':
          // Continue waiting
          await this.sleep(5000); // Check every 5 seconds
          break;
        
        default:
          throw new Error(`Unknown processing status: ${fileInfo.processing_status}`);
      }
    }
    
    throw new Error('File processing timeout');
  }

  // Step 3: Create quality assessment
  async createAssessment(fileId, options = {}) {
    console.log(`Creating assessment for file: ${fileId}`);
    
    const assessmentConfig = {
      file_id: fileId,
      assessment_model: options.model || 'gpt-4',
      quality_dimensions: options.dimensions || ['accuracy', 'fluency', 'terminology', 'style'],
      include_suggestions: options.includeSuggestions !== false,
      priority: options.priority || 'normal',
      custom_instructions: options.customInstructions || ''
    };

    const result = await this.apiRequest('/assessments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assessmentConfig)
    });

    console.log(`Assessment created. Assessment ID: ${result.assessment_id}`);
    return result;
  }

  // Step 4: Monitor assessment progress
  async waitForAssessment(assessmentId, maxWaitTime = 600000) { // 10 minutes max
    console.log(`Monitoring assessment progress: ${assessmentId}`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const assessment = await this.apiRequest(`/assessments/${assessmentId}`);
      
      console.log(`Assessment status: ${assessment.status}`);
      
      switch (assessment.status) {
        case 'completed':
          console.log('Assessment completed successfully');
          return assessment;
        
        case 'failed':
          throw new Error(`Assessment failed: ${assessment.error_message}`);
        
        case 'processing':
        case 'queued':
          // Continue waiting
          await this.sleep(10000); // Check every 10 seconds
          break;
        
        default:
          throw new Error(`Unknown assessment status: ${assessment.status}`);
      }
    }
    
    throw new Error('Assessment processing timeout');
  }

  // Step 5: Download assessment report
  async downloadReport(assessmentId, format = 'pdf', outputPath = null) {
    console.log(`Downloading ${format} report for assessment: ${assessmentId}`);
    
    const response = await fetch(
      `${this.baseUrl}/assessments/${assessmentId}/report?format=${format}`,
      {
        headers: {
          'X-API-Key': this.apiKey
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to download report: ${errorData.error?.message}`);
    }

    const buffer = await response.buffer();
    
    if (outputPath) {
      fs.writeFileSync(outputPath, buffer);
      console.log(`Report saved to: ${outputPath}`);
    }
    
    return buffer;
  }

  // Complete workflow method
  async processTranslationFile(filePath, options = {}) {
    try {
      console.log('Starting complete translation QA workflow...');
      
      // Step 1: Upload file
      const uploadResult = await this.uploadFile(filePath, options);
      const fileId = uploadResult.file_id;
      
      // Step 2: Wait for file processing
      await this.waitForProcessing(fileId);
      
      // Step 3: Create assessment
      const assessmentResult = await this.createAssessment(fileId, options);
      const assessmentId = assessmentResult.assessment_id;
      
      // Step 4: Wait for assessment completion
      const completedAssessment = await this.waitForAssessment(assessmentId);
      
      // Step 5: Download reports
      const reports = {};
      
      if (options.downloadFormats) {
        for (const format of options.downloadFormats) {
          const outputPath = options.outputDir ? 
            path.join(options.outputDir, `assessment-${assessmentId}.${format}`) : 
            null;
          reports[format] = await this.downloadReport(assessmentId, format, outputPath);
        }
      }
      
      console.log('Workflow completed successfully!');
      
      return {
        fileId,
        assessmentId,
        assessment: completedAssessment,
        reports
      };
      
    } catch (error) {
      console.error('Workflow failed:', error.message);
      throw error;
    }
  }
}
```

### Usage Examples

```javascript
// Example 1: Basic workflow
async function basicWorkflow() {
  const workflow = new TranslationQAWorkflow('your-api-key');
  
  try {
    const result = await workflow.processTranslationFile('./translation.xliff', {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      model: 'gpt-4',
      dimensions: ['accuracy', 'fluency', 'terminology'],
      downloadFormats: ['pdf', 'json'],
      outputDir: './reports'
    });
    
    console.log('Processing complete:', result.assessmentId);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 2: Batch processing multiple files
async function batchWorkflow() {
  const workflow = new TranslationQAWorkflow('your-api-key');
  const files = ['file1.xliff', 'file2.xliff', 'file3.xliff'];
  
  const results = [];
  
  for (const file of files) {
    try {
      console.log(`Processing ${file}...`);
      const result = await workflow.processTranslationFile(file, {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        priority: 'high'
      });
      results.push({ file, result });
    } catch (error) {
      console.error(`Failed to process ${file}:`, error.message);
      results.push({ file, error: error.message });
    }
  }
  
  console.log('Batch processing complete:', results);
}

// Example 3: Custom assessment workflow
async function customAssessmentWorkflow() {
  const workflow = new TranslationQAWorkflow('your-api-key');
  
  try {
    // Upload file
    const uploadResult = await workflow.uploadFile('./specialized-text.xliff', {
      sourceLanguage: 'en',
      targetLanguage: 'de'
    });
    
    // Wait for processing
    await workflow.waitForProcessing(uploadResult.file_id);
    
    // Create custom assessment
    const assessment = await workflow.createAssessment(uploadResult.file_id, {
      model: 'gpt-4',
      dimensions: ['accuracy', 'terminology', 'consistency'],
      customInstructions: 'Pay special attention to technical terminology and consistency across document sections.',
      priority: 'high'
    });
    
    // Monitor and download
    await workflow.waitForAssessment(assessment.assessment_id);
    await workflow.downloadReport(assessment.assessment_id, 'json', './custom-report.json');
    
  } catch (error) {
    console.error('Custom workflow failed:', error.message);
  }
}

// Run examples
basicWorkflow();
```

---

## Python Implementation

```python
import asyncio
import aiohttp
import aiofiles
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Union

class TranslationQAWorkflow:
    def __init__(self, api_key: str, base_url: str = "https://api.qa-platform.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.max_retries = 3
        self.retry_delay = 1.0
        
    async def api_request(self, session: aiohttp.ClientSession, endpoint: str, **kwargs) -> Dict:
        """Make API request with retry logic and error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.get('headers', {})
        headers['X-API-Key'] = self.api_key
        kwargs['headers'] = headers
        
        for attempt in range(1, self.max_retries + 1):
            try:
                async with session.request(**kwargs, url=url) as response:
                    # Handle rate limiting
                    if response.status == 429:
                        retry_after = int(response.headers.get('retry-after', 60))
                        print(f"Rate limited. Waiting {retry_after} seconds...")
                        await asyncio.sleep(retry_after)
                        continue
                    
                    if not response.ok:
                        error_data = await response.json()
                        raise Exception(f"API Error {response.status}: {error_data.get('error', {}).get('message', 'Unknown error')}")
                    
                    return await response.json()
                    
            except Exception as error:
                print(f"Attempt {attempt} failed: {error}")
                
                if attempt == self.max_retries:
                    raise error
                
                delay = self.retry_delay * (2 ** (attempt - 1))
                print(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)
    
    async def upload_file(self, session: aiohttp.ClientSession, file_path: str, **options) -> Dict:
        """Upload XLIFF file for processing"""
        print(f"Uploading file: {file_path}")
        
        data = aiohttp.FormData()
        data.add_field('file', open(file_path, 'rb'), filename=Path(file_path).name)
        data.add_field('source_language', options.get('source_language', 'en'))
        data.add_field('target_language', options.get('target_language', 'fr'))
        data.add_field('assessment_model', options.get('model', 'gpt-4'))
        data.add_field('priority', options.get('priority', 'normal'))
        
        result = await self.api_request(session, '/files', method='POST', data=data)
        print(f"File uploaded. File ID: {result['file_id']}")
        return result
    
    async def wait_for_processing(self, session: aiohttp.ClientSession, file_id: str, max_wait: int = 300) -> Dict:
        """Monitor file processing status"""
        print(f"Monitoring processing for file: {file_id}")
        
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            file_info = await self.api_request(session, f'/files/{file_id}', method='GET')
            status = file_info['processing_status']
            
            print(f"Processing status: {status}")
            
            if status == 'completed':
                print("File processing completed")
                return file_info
            elif status == 'failed':
                raise Exception(f"Processing failed: {file_info.get('error_message')}")
            
            await asyncio.sleep(5)
        
        raise Exception("Processing timeout")
    
    async def create_assessment(self, session: aiohttp.ClientSession, file_id: str, **options) -> Dict:
        """Create quality assessment"""
        print(f"Creating assessment for file: {file_id}")
        
        config = {
            'file_id': file_id,
            'assessment_model': options.get('model', 'gpt-4'),
            'quality_dimensions': options.get('dimensions', ['accuracy', 'fluency', 'terminology', 'style']),
            'include_suggestions': options.get('include_suggestions', True),
            'priority': options.get('priority', 'normal'),
            'custom_instructions': options.get('custom_instructions', '')
        }
        
        result = await self.api_request(
            session, 
            '/assessments', 
            method='POST',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(config)
        )
        
        print(f"Assessment created. ID: {result['assessment_id']}")
        return result
    
    async def wait_for_assessment(self, session: aiohttp.ClientSession, assessment_id: str, max_wait: int = 600) -> Dict:
        """Monitor assessment progress"""
        print(f"Monitoring assessment: {assessment_id}")
        
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            assessment = await self.api_request(session, f'/assessments/{assessment_id}', method='GET')
            status = assessment['status']
            
            print(f"Assessment status: {status}")
            
            if status == 'completed':
                print("Assessment completed")
                return assessment
            elif status == 'failed':
                raise Exception(f"Assessment failed: {assessment.get('error_message')}")
            
            await asyncio.sleep(10)
        
        raise Exception("Assessment timeout")
    
    async def download_report(self, session: aiohttp.ClientSession, assessment_id: str, format: str = 'pdf', output_path: Optional[str] = None) -> bytes:
        """Download assessment report"""
        print(f"Downloading {format} report for assessment: {assessment_id}")
        
        url = f"{self.base_url}/assessments/{assessment_id}/report?format={format}"
        headers = {'X-API-Key': self.api_key}
        
        async with session.get(url, headers=headers) as response:
            if not response.ok:
                error_data = await response.json()
                raise Exception(f"Download failed: {error_data.get('error', {}).get('message')}")
            
            content = await response.read()
            
            if output_path:
                async with aiofiles.open(output_path, 'wb') as f:
                    await f.write(content)
                print(f"Report saved to: {output_path}")
            
            return content
    
    async def process_translation_file(self, file_path: str, **options) -> Dict:
        """Complete workflow for processing a translation file"""
        try:
            print("Starting translation QA workflow...")
            
            async with aiohttp.ClientSession() as session:
                # Upload file
                upload_result = await self.upload_file(session, file_path, **options)
                file_id = upload_result['file_id']
                
                # Wait for processing
                await self.wait_for_processing(session, file_id)
                
                # Create assessment
                assessment_result = await self.create_assessment(session, file_id, **options)
                assessment_id = assessment_result['assessment_id']
                
                # Wait for assessment
                completed_assessment = await self.wait_for_assessment(session, assessment_id)
                
                # Download reports
                reports = {}
                download_formats = options.get('download_formats', ['pdf'])
                
                for format in download_formats:
                    output_path = None
                    if options.get('output_dir'):
                        output_path = f"{options['output_dir']}/assessment-{assessment_id}.{format}"
                    
                    reports[format] = await self.download_report(session, assessment_id, format, output_path)
                
                print("Workflow completed successfully!")
                
                return {
                    'file_id': file_id,
                    'assessment_id': assessment_id,
                    'assessment': completed_assessment,
                    'reports': reports
                }
                
        except Exception as error:
            print(f"Workflow failed: {error}")
            raise

# Usage example
async def main():
    workflow = TranslationQAWorkflow('your-api-key')
    
    result = await workflow.process_translation_file(
        './translation.xliff',
        source_language='en',
        target_language='fr',
        model='gpt-4',
        dimensions=['accuracy', 'fluency', 'terminology'],
        download_formats=['pdf', 'json'],
        output_dir='./reports'
    )
    
    print(f"Processing complete: {result['assessment_id']}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Key Features of This Workflow

### Error Handling
- Retry logic with exponential backoff
- Rate limiting detection and handling
- Comprehensive error messages
- Timeout protection

### Status Monitoring
- Real-time status updates
- Configurable polling intervals
- Progress reporting

### Flexibility
- Configurable options for all steps
- Support for multiple output formats
- Batch processing capabilities
- Custom assessment parameters

### Best Practices
- Proper resource cleanup
- Asynchronous operations (Python)
- Structured logging
- Type hints and documentation

This workflow provides a robust foundation for integrating the Translation QA API into production applications. 