export const testData = {
  // Test users for different scenarios
  users: {
    admin: {
      email: 'admin@test.com',
      password: 'TestPassword123!',
      name: 'Test Admin',
      role: 'admin'
    },
    manager: {
      email: 'manager@test.com',
      password: 'TestPassword123!',
      name: 'Test Manager',
      role: 'manager'
    },
    user: {
      email: 'user@test.com',
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'user'
    },
    // For registration tests - use random emails
    newUser: () => ({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'New Test User'
    })
  },

  // Sample documents for upload testing
  documents: {
    samplePDF: {
      name: 'sample-document.pdf',
      type: 'application/pdf',
      size: '1.2MB'
    },
    sampleDocx: {
      name: 'sample-document.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: '850KB'
    },
    sampleTxt: {
      name: 'sample-text.txt',
      type: 'text/plain',
      size: '5KB'
    },
    invalidFile: {
      name: 'invalid-file.xyz',
      type: 'application/unknown',
      size: '10MB'
    }
  },

  // Form data for various tests
  forms: {
    feedback: {
      rating: 4,
      comment: 'This is a test feedback comment for E2E testing.',
      category: 'Feature Request'
    },
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      company: 'Test Company Inc.',
      phone: '+1234567890'
    },
    billing: {
      cardNumber: '4242424242424242',
      expiryDate: '12/25',
      cvc: '123',
      name: 'Test User',
      address: '123 Test Street',
      city: 'Test City',
      postalCode: '12345',
      country: 'US'
    }
  },

  // API endpoints for mocking
  apiEndpoints: {
    auth: {
      login: '/api/auth/login',
      register: '/api/auth/register',
      logout: '/api/auth/logout',
      verifyEmail: '/api/auth/verify-email'
    },
    upload: {
      file: '/api/upload/file',
      progress: '/api/upload/progress',
      analyze: '/api/analyze/document'
    },
    reports: {
      list: '/api/reports',
      detail: '/api/reports/:id',
      download: '/api/reports/:id/download'
    },
    billing: {
      subscription: '/api/billing/subscription',
      invoice: '/api/billing/invoice',
      payment: '/api/billing/payment'
    }
  },

  // Mock responses for API testing
  mockResponses: {
    authSuccess: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      },
      token: 'mock-jwt-token'
    },
    uploadSuccess: {
      id: 'upload-123',
      filename: 'test-document.pdf',
      status: 'uploaded',
      analysisId: 'analysis-456'
    },
    reportsData: [
      {
        id: 'report-1',
        name: 'Sample Report 1',
        createdAt: '2024-01-01T00:00:00Z',
        status: 'completed',
        score: 85
      },
      {
        id: 'report-2',
        name: 'Sample Report 2',
        createdAt: '2024-01-02T00:00:00Z',
        status: 'processing',
        score: null
      }
    ],
    dashboardMetrics: {
      totalReports: 42,
      averageScore: 87.5,
      recentUploads: 5,
      systemHealth: 'good'
    }
  },

  // Test scenarios and user journeys
  scenarios: {
    quickUploadAnalysis: {
      name: 'Quick Upload and Analysis',
      steps: [
        'Login as regular user',
        'Navigate to upload page',
        'Upload sample document',
        'Wait for analysis completion',
        'View generated report',
        'Download report'
      ]
    },
    adminUserManagement: {
      name: 'Admin User Management Flow',
      steps: [
        'Login as admin',
        'Navigate to user management',
        'Create new user',
        'Assign roles and permissions',
        'Verify user creation',
        'Edit user details',
        'Deactivate user'
      ]
    },
    billingSubscription: {
      name: 'Billing and Subscription Management',
      steps: [
        'Login as user',
        'Navigate to billing',
        'View current plan',
        'Upgrade subscription',
        'Update payment method',
        'Download invoice'
      ]
    }
  },

  // Wait times for various operations
  timeouts: {
    short: 5000,    // 5 seconds
    medium: 15000,  // 15 seconds
    long: 30000,    // 30 seconds
    upload: 60000,  // 1 minute for file uploads
    analysis: 120000 // 2 minutes for document analysis
  },

  // Selectors commonly used across tests
  selectors: {
    navigation: {
      logo: '[data-testid="app-logo"]',
      userMenu: '[data-testid="user-menu"]',
      mainNav: '[data-testid="main-navigation"]'
    },
    forms: {
      loginForm: '[data-testid="login-form"]',
      registerForm: '[data-testid="register-form"]',
      uploadForm: '[data-testid="upload-form"]'
    },
    buttons: {
      submit: 'button[type="submit"]',
      cancel: 'button[type="button"]:has-text("Cancel")',
      save: 'button:has-text("Save")',
      upload: '[data-testid="upload-button"]'
    },
    messages: {
      success: '[data-testid="success-message"]',
      error: '[data-testid="error-message"]',
      loading: '[data-testid="loading-spinner"]'
    }
  }
};

// Utility functions for test data
export const generateUniqueEmail = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
};

export const generateTestFileName = (extension: string = 'pdf'): string => {
  return `test-file-${Date.now()}.${extension}`;
};

export const createMockFile = (name: string, type: string, size: number = 1024): File => {
  const content = 'a'.repeat(size);
  return new File([content], name, { type });
}; 