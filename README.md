# AI-Powered Linguistic QA Platform

![Platform Preview](https://img.shields.io/badge/Status-In%20Development-yellow)
![Tech Stack](https://img.shields.io/badge/Tech-React%20%7C%20TypeScript%20%7C%20Vite-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Overview

The AI-Powered Linguistic QA Platform is a comprehensive web application designed to assess translation quality using advanced Large Language Models (LLMs). The platform enables users to upload XLIFF files, receive detailed quality assessment reports, and manage linguistic quality evaluation workflows with industry-standard MQM (Multidimensional Quality Metrics) scoring.

## ✨ Features

### 📁 File Upload & Processing
- Support for XLIFF 1.2, 2.0, and MXLIFF file formats
- Drag-and-drop file upload interface
- Real-time upload progress tracking
- File validation and error handling
- Batch file processing capabilities

### 🤖 AI-Powered Quality Assessment
- LLM-based linguistic analysis using advanced models
- Automated error detection and categorization
- MQM (Multidimensional Quality Metrics) scoring
- Comprehensive quality reports with detailed feedback
- Support for multiple language pairs

### 📊 Dashboard & Analytics
- Real-time processing status updates
- Historical data visualization
- Quality trend analysis
- Export capabilities (PDF, CSV, Excel)
- Customizable reporting dashboards

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui components  
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Form Handling**: React Hook Form + Zod validation
- **File Upload**: React Dropzone
- **Charts**: Recharts
- **Backend**: Supabase (Database + Authentication)
- **Development**: ESLint + TypeScript ESLint

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/gloos/fluent-scribe-qa-platform.git
   cd fluent-scribe-qa-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   ```
   http://localhost:5173
   ```

## 📋 Development Workflow

This project uses [TaskMaster AI](https://github.com/gloos/task-master-ai) for task management and development workflow automation.

### Task Management Commands

```bash
# View current tasks
task-master list

# Get next task to work on
task-master next

# Update task status
task-master set-status --id=<task-id> --status=<status>

# Generate task files
task-master generate
```

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: implement feature description"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Quality

- **Linting**: `npm run lint`
- **Type Checking**: Built into Vite development server
- **Code Formatting**: Configured with ESLint
- **Pre-commit Hooks**: Automated linting and type checking

## 📁 Project Structure

```
fluent-scribe-qa-platform/
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── tasks/                 # TaskMaster AI task files
├── scripts/               # Development scripts and docs
├── public/                # Static assets
└── docs/                  # Additional documentation
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🤝 Contributing

1. **Fork the repository**
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add appropriate tests for new features
- Update documentation as needed
- Use TaskMaster AI for task management and progress tracking

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📞 Support

For questions, issues, or contributions, please:

1. Check existing [GitHub Issues](https://github.com/gloos/fluent-scribe-qa-platform/issues)
2. Create a new issue with detailed information
3. Join our community discussions

---

**Built with ❤️ using React, TypeScript, and AI-powered workflow automation**
