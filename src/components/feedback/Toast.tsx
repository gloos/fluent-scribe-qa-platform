import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  X,
  AlertCircle 
} from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  persistent?: boolean
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'error' ? 8000 : 5000)
    }

    setToasts(prev => [...prev, newToast])

    // Auto remove toast if not persistent
    if (!newToast.persistent && newToast.duration) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// Individual Toast Component
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ 
  toast, 
  onRemove 
}) => {
  const [isLeaving, setIsLeaving] = useState(false)

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getColorClasses = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      case 'info':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
    }
  }

  const handleRemove = () => {
    setIsLeaving(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <Card 
      className={cn(
        "p-4 border-l-4 shadow-lg transition-all duration-300 ease-in-out transform",
        getColorClasses(toast.type),
        isLeaving 
          ? "translate-x-full opacity-0" 
          : "translate-x-0 opacity-100 animate-in slide-in-from-right-full"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(toast.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              {toast.title}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-background/80"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {toast.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {toast.description}
            </p>
          )}
          
          {toast.action && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={toast.action.onClick}
            >
              {toast.action.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// Toast Container Component
const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]">
      {toasts.map(toast => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onRemove={removeToast}
        />
      ))}
    </div>
  )
}

// Utility hooks for common toast patterns
export const useSuccessToast = () => {
  const { addToast } = useToast()
  
  return useCallback((title: string, description?: string) => {
    return addToast({
      type: 'success',
      title,
      description
    })
  }, [addToast])
}

export const useErrorToast = () => {
  const { addToast } = useToast()
  
  return useCallback((title: string, description?: string, action?: Toast['action']) => {
    return addToast({
      type: 'error',
      title,
      description,
      action,
      persistent: true // Errors should be manually dismissed
    })
  }, [addToast])
}

export const useWarningToast = () => {
  const { addToast } = useToast()
  
  return useCallback((title: string, description?: string) => {
    return addToast({
      type: 'warning',
      title,
      description,
      duration: 7000
    })
  }, [addToast])
}

export const useInfoToast = () => {
  const { addToast } = useToast()
  
  return useCallback((title: string, description?: string) => {
    return addToast({
      type: 'info',
      title,
      description
    })
  }, [addToast])
}

// QA-specific toast utilities
export const useQAToasts = () => {
  const { addToast } = useToast()
  
  const sessionStarted = useCallback((filename: string) => {
    return addToast({
      type: 'success',
      title: 'QA Session Started',
      description: `Processing ${filename}...`
    })
  }, [addToast])

  const errorDetected = useCallback((errorCount: number, segmentId: string) => {
    return addToast({
      type: 'warning',
      title: `${errorCount} Error${errorCount > 1 ? 's' : ''} Detected`,
      description: `Found in segment ${segmentId}`,
      action: {
        label: 'Review',
        onClick: () => {
          // Navigate to error review
          console.log('Navigate to error review')
        }
      }
    })
  }, [addToast])

  const sessionCompleted = useCallback((segmentCount: number, score: number) => {
    return addToast({
      type: 'success',
      title: 'QA Session Completed',
      description: `Reviewed ${segmentCount} segments. Quality score: ${score}%`,
      duration: 10000
    })
  }, [addToast])

  const uploadFailed = useCallback((reason: string) => {
    return addToast({
      type: 'error',
      title: 'Upload Failed',
      description: reason,
      action: {
        label: 'Retry',
        onClick: () => {
          // Retry upload logic
          console.log('Retry upload')
        }
      },
      persistent: true
    })
  }, [addToast])

  return {
    sessionStarted,
    errorDetected,
    sessionCompleted,
    uploadFailed
  }
}

export default ToastProvider 