import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendData } from "@/hooks/useReportFilters";

interface TrendIndicatorProps {
  trend: TrendData;
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export const TrendIndicator = ({ 
  trend, 
  className, 
  showIcon = true, 
  showText = true 
}: TrendIndicatorProps) => {
  const getIcon = () => {
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      case 'stable':
        return <Minus className="h-3 w-3" />;
    }
  };

  const getColorClass = () => {
    switch (trend.direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-500';
    }
  };

  return (
    <div className={cn("flex items-center gap-1", getColorClass(), className)}>
      {showIcon && getIcon()}
      {showText && (
        <span className="text-xs font-medium">
          {trend.changeText}
        </span>
      )}
    </div>
  );
}; 