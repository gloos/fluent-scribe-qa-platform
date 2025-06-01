import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: 'default' | 'success' | 'error' | 'warning'
  showAnimation?: boolean
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = 'default', showAnimation = false, ...props }, ref) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-primary'
    }
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          getVariantClasses(),
          showAnimation && "animate-pulse"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
      {showAnimation && value && value > 0 && value < 100 && (
        <div 
          className="absolute top-0 right-0 h-full w-8 bg-gradient-to-r from-transparent to-white/20 animate-pulse"
          style={{ 
            transform: `translateX(-${100 - (value || 0)}%)`,
            animation: 'shimmer 1.5s ease-in-out infinite'
          }}
        />
      )}
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
