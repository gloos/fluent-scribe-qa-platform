import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  AlertTriangle, 
  Trash2, 
  FileX, 
  RotateCcw,
  CheckCircle,
  X,
  AlertCircle
} from 'lucide-react'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning' | 'default'
  icon?: React.ReactNode
  requireConfirmation?: boolean
  confirmationText?: string
  loading?: boolean
  children?: React.ReactNode
}

const dialogVariants = {
  destructive: {
    container: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20',
    header: 'text-red-900 dark:text-red-400',
    confirmButton: 'destructive'
  },
  warning: {
    container: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20',
    header: 'text-yellow-900 dark:text-yellow-400',
    confirmButton: 'default'
  },
  default: {
    container: 'border-border bg-background',
    header: 'text-foreground',
    confirmButton: 'default'
  }
} as const

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  requireConfirmation = false,
  confirmationText = 'DELETE',
  loading = false,
  children
}) => {
  const [confirmationInput, setConfirmationInput] = useState('')
  
  const variantConfig = dialogVariants[variant]
  const canConfirm = !requireConfirmation || confirmationInput === confirmationText

  const handleConfirm = () => {
    if (canConfirm && !loading) {
      onConfirm()
    }
  }

  const handleClose = () => {
    if (!loading) {
      setConfirmationInput('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <Card className={cn(
        "relative w-full max-w-md p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200",
        variantConfig.container
      )}>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            {icon || (
              variant === 'destructive' ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : variant === 'warning' ? (
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-blue-600" />
              )
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-lg font-semibold mb-2",
              variantConfig.header
            )}>
              {title}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-4">
              {description}
            </p>
            
            {children && (
              <div className="mb-4">
                {children}
              </div>
            )}
            
            {/* Confirmation Input */}
            {requireConfirmation && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Type "{confirmationText}" to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                  placeholder={confirmationText}
                  disabled={loading}
                />
              </div>
            )}
            
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={loading}
              >
                {cancelText}
              </Button>
              
              <Button
                variant={variantConfig.confirmButton as any}
                size="sm"
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
              >
                {loading ? 'Processing...' : confirmText}
              </Button>
            </div>
          </div>
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}

// Hook for managing confirmation dialogs
export interface UseConfirmDialogProps {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning' | 'default'
  icon?: React.ReactNode
  requireConfirmation?: boolean
  confirmationText?: string
}

export const useConfirmDialog = () => {
  const [dialog, setDialog] = useState<{
    isOpen: boolean
    props: UseConfirmDialogProps
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const confirm = (props: UseConfirmDialogProps): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        props,
        resolve
      })
    })
  }

  const handleConfirm = () => {
    if (dialog) {
      dialog.resolve(true)
      setDialog(null)
    }
  }

  const handleClose = () => {
    if (dialog) {
      dialog.resolve(false)
      setDialog(null)
    }
  }

  const ConfirmDialogComponent = dialog ? (
    <ConfirmDialog
      isOpen={dialog.isOpen}
      onConfirm={handleConfirm}
      onClose={handleClose}
      {...dialog.props}
    />
  ) : null

  return {
    confirm,
    ConfirmDialogComponent
  }
}

// QA-specific Confirmation Dialogs
export interface DeleteSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  sessionName: string
  segmentCount: number
  loading?: boolean
}

export const DeleteSessionDialog: React.FC<DeleteSessionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
  segmentCount,
  loading = false
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete QA Session"
      description={`Are you sure you want to delete the session "${sessionName}"? This will permanently remove all ${segmentCount} reviewed segments and cannot be undone.`}
      confirmText="Delete Session"
      variant="destructive"
      icon={<Trash2 className="h-6 w-6 text-red-600" />}
      requireConfirmation
      confirmationText="DELETE"
      loading={loading}
    >
      <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-sm font-medium text-red-800 dark:text-red-400">
          This action cannot be undone
        </div>
        <ul className="text-xs text-red-700 dark:text-red-300 mt-1 space-y-1">
          <li>• All segment reviews will be lost</li>
          <li>• Error annotations will be deleted</li>
          <li>• Quality scores will be removed</li>
          <li>• Session history will be cleared</li>
        </ul>
      </div>
    </ConfirmDialog>
  )
}

export interface ResetProgressDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  currentProgress: number
  loading?: boolean
}

export const ResetProgressDialog: React.FC<ResetProgressDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentProgress,
  loading = false
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Reset Session Progress"
      description={`You have completed ${currentProgress}% of this session. Resetting will clear all current progress and start the session from the beginning.`}
      confirmText="Reset Progress"
      cancelText="Keep Progress"
      variant="warning"
      icon={<RotateCcw className="h-6 w-6 text-yellow-600" />}
      loading={loading}
    >
      <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
          Progress will be lost
        </div>
        <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
          All segment reviews, error annotations, and quality assessments from this session will be cleared.
        </div>
      </div>
    </ConfirmDialog>
  )
}

export interface DiscardChangesDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  unsavedChanges: number
  loading?: boolean
}

export const DiscardChangesDialog: React.FC<DiscardChangesDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  unsavedChanges,
  loading = false
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Discard Unsaved Changes"
      description={`You have ${unsavedChanges} unsaved change${unsavedChanges > 1 ? 's' : ''}. Leaving now will lose all your recent work.`}
      confirmText="Discard Changes"
      cancelText="Save & Continue"
      variant="warning"
      icon={<FileX className="h-6 w-6 text-yellow-600" />}
      loading={loading}
    >
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Consider saving your work before leaving:
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Save functionality would be implemented here
              console.log('Save and continue')
            }}
            disabled={loading}
          >
            Save Progress
          </Button>
        </div>
      </div>
    </ConfirmDialog>
  )
}

export interface BulkActionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  action: 'approve' | 'reject' | 'delete'
  itemCount: number
  itemType: 'segments' | 'errors' | 'sessions'
  loading?: boolean
}

export const BulkActionDialog: React.FC<BulkActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  itemCount,
  itemType,
  loading = false
}) => {
  const getActionConfig = () => {
    switch (action) {
      case 'approve':
        return {
          title: `Approve ${itemCount} ${itemType}`,
          description: `This will mark ${itemCount} ${itemType} as approved and update their status.`,
          confirmText: 'Approve All',
          variant: 'default' as const,
          icon: <CheckCircle className="h-6 w-6 text-green-600" />
        }
      case 'reject':
        return {
          title: `Reject ${itemCount} ${itemType}`,
          description: `This will mark ${itemCount} ${itemType} as rejected and they will need to be reviewed again.`,
          confirmText: 'Reject All',
          variant: 'warning' as const,
          icon: <X className="h-6 w-6 text-yellow-600" />
        }
      case 'delete':
        return {
          title: `Delete ${itemCount} ${itemType}`,
          description: `This will permanently delete ${itemCount} ${itemType}. This action cannot be undone.`,
          confirmText: 'Delete All',
          variant: 'destructive' as const,
          icon: <Trash2 className="h-6 w-6 text-red-600" />,
          requireConfirmation: true
        }
    }
  }

  const config = getActionConfig()

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={config.title}
      description={config.description}
      confirmText={config.confirmText}
      variant={config.variant}
      icon={config.icon}
      requireConfirmation={config.requireConfirmation}
      confirmationText="DELETE"
      loading={loading}
    />
  )
}

export default ConfirmDialog 