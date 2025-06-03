import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { 
  GripVertical, 
  Trash2, 
  Plus,
  AlertTriangle,
  CheckCircle2,
  Shuffle,
  RotateCcw,
  TrendingUp,
  Info
} from 'lucide-react';

export interface WeightedItem {
  id: string;
  name: string;
  weight: number;
  description?: string;
  locked?: boolean;
  minWeight?: number;
  maxWeight?: number;
}

export interface WeightingSystemProps {
  items: WeightedItem[];
  onItemsChange: (items: WeightedItem[]) => void;
  title?: string;
  description?: string;
  targetTotal?: number;
  allowReordering?: boolean;
  allowLocking?: boolean;
  showSliders?: boolean;
  className?: string;
  isReadOnly?: boolean;
}

export const WeightingSystem: React.FC<WeightingSystemProps> = ({
  items,
  onItemsChange,
  title = "Weight Management",
  description = "Adjust weights for each item",
  targetTotal = 100,
  allowReordering = true,
  allowLocking = false,
  showSliders = true,
  className = "",
  isReadOnly = false
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [autoNormalizeEnabled, setAutoNormalizeEnabled] = useState(true);

  // Calculate current total weight
  const currentTotal = items.reduce((sum, item) => sum + item.weight, 0);
  const isBalanced = Math.abs(currentTotal - targetTotal) < 0.01;
  const completionPercentage = Math.min((currentTotal / targetTotal) * 100, 100);

  // Weight validation
  const getValidationStatus = () => {
    if (isBalanced) return { type: 'success', message: 'Weights are perfectly balanced' };
    if (currentTotal > targetTotal) return { type: 'error', message: `Weights exceed target (${currentTotal.toFixed(1)}% > ${targetTotal}%)` };
    if (currentTotal < targetTotal) return { type: 'warning', message: `Weights below target (${currentTotal.toFixed(1)}% < ${targetTotal}%)` };
    return { type: 'info', message: 'Adjusting weights...' };
  };

  const validationStatus = getValidationStatus();

  // Auto-normalize weights when items change
  useEffect(() => {
    if (autoNormalizeEnabled && items.length > 0 && Math.abs(currentTotal - targetTotal) > 0.1) {
      const lockedItems = items.filter(item => item.locked);
      const unlockedItems = items.filter(item => !item.locked);
      
      if (unlockedItems.length > 0) {
        const lockedTotal = lockedItems.reduce((sum, item) => sum + item.weight, 0);
        const availableWeight = Math.max(0, targetTotal - lockedTotal);
        
        const normalizedItems = items.map(item => {
          if (item.locked) return item;
          
          const unlockedTotal = unlockedItems.reduce((sum, unlocked) => sum + unlocked.weight, 0);
          const proportion = unlockedTotal > 0 ? item.weight / unlockedTotal : 1 / unlockedItems.length;
          const newWeight = Math.min(
            Math.max(availableWeight * proportion, item.minWeight || 0),
            item.maxWeight || 100
          );
          
          return { ...item, weight: Math.round(newWeight * 100) / 100 };
        });
        
        if (JSON.stringify(normalizedItems) !== JSON.stringify(items)) {
          onItemsChange(normalizedItems);
        }
      }
    }
  }, [items.length, autoNormalizeEnabled, targetTotal]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!allowReordering || isReadOnly) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
  }, [allowReordering, isReadOnly]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!allowReordering || isReadOnly || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, [allowReordering, isReadOnly, draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    if (!allowReordering || isReadOnly || draggedIndex === null) return;
    e.preventDefault();
    
    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    
    // Remove the dragged item
    newItems.splice(draggedIndex, 1);
    
    // Insert at new position
    const insertIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newItems.splice(insertIndex, 0, draggedItem);
    
    onItemsChange(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [allowReordering, isReadOnly, draggedIndex, items, onItemsChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // Weight adjustment handlers
  const updateItemWeight = useCallback((index: number, newWeight: number) => {
    if (isReadOnly) return;
    
    const updatedItems = items.map((item, i) => 
      i === index ? { 
        ...item, 
        weight: Math.min(Math.max(newWeight, item.minWeight || 0), item.maxWeight || 100)
      } : item
    );
    onItemsChange(updatedItems);
  }, [items, onItemsChange, isReadOnly]);

  const toggleItemLock = useCallback((index: number) => {
    if (!allowLocking || isReadOnly) return;
    
    const updatedItems = items.map((item, i) => 
      i === index ? { ...item, locked: !item.locked } : item
    );
    onItemsChange(updatedItems);
  }, [items, onItemsChange, allowLocking, isReadOnly]);

  // Auto-balance functions
  const autoBalance = useCallback(() => {
    if (isReadOnly) return;
    
    const lockedItems = items.filter(item => item.locked);
    const unlockedItems = items.filter(item => !item.locked);
    
    if (unlockedItems.length === 0) return;
    
    const lockedTotal = lockedItems.reduce((sum, item) => sum + item.weight, 0);
    const availableWeight = Math.max(0, targetTotal - lockedTotal);
    const weightPerItem = availableWeight / unlockedItems.length;
    
    const balancedItems = items.map(item => 
      item.locked ? item : { ...item, weight: Math.round(weightPerItem * 100) / 100 }
    );
    
    onItemsChange(balancedItems);
  }, [items, onItemsChange, targetTotal, isReadOnly]);

  const redistributeEvenly = useCallback(() => {
    if (isReadOnly) return;
    
    const weightPerItem = targetTotal / items.length;
    const redistributedItems = items.map(item => ({
      ...item,
      weight: Math.round(weightPerItem * 100) / 100,
      locked: false
    }));
    
    onItemsChange(redistributedItems);
  }, [items, onItemsChange, targetTotal, isReadOnly]);

  const normalizeWeights = useCallback(() => {
    if (isReadOnly || currentTotal === 0) return;
    
    const factor = targetTotal / currentTotal;
    const normalizedItems = items.map(item => ({
      ...item,
      weight: Math.round(item.weight * factor * 100) / 100
    }));
    
    onItemsChange(normalizedItems);
  }, [items, onItemsChange, currentTotal, targetTotal, isReadOnly]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={autoBalance}
                className="flex items-center gap-1"
              >
                <Shuffle className="h-3 w-3" />
                Balance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redistributeEvenly}
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={normalizeWeights}
                className="flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Normalize
              </Button>
            </div>
          )}
        </div>

        {/* Weight Summary */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span>Total Weight</span>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${
                validationStatus.type === 'success' ? 'text-green-600' :
                validationStatus.type === 'error' ? 'text-red-600' :
                validationStatus.type === 'warning' ? 'text-orange-600' : 'text-blue-600'
              }`}>
                {currentTotal.toFixed(1)}% / {targetTotal}%
              </span>
              {validationStatus.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {validationStatus.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
            </div>
          </div>
          
          <Progress 
            value={completionPercentage} 
            className={`h-3 ${validationStatus.type === 'error' ? 'bg-red-100' : ''}`}
          />
          
          {validationStatus.type !== 'success' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{validationStatus.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No items to weight</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 transition-all duration-200 ${
                draggedIndex === index ? 'opacity-50 scale-95' : ''
              } ${
                dragOverIndex === index ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              } ${
                allowReordering && !isReadOnly ? 'cursor-move' : ''
              }`}
              draggable={allowReordering && !isReadOnly}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center gap-4">
                {/* Drag Handle */}
                {allowReordering && !isReadOnly && (
                  <div className="flex-shrink-0 text-gray-400">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium truncate">{item.name}</h4>
                    <Badge variant="outline" className={
                      item.weight >= (item.minWeight || 0) && item.weight <= (item.maxWeight || 100)
                        ? 'border-green-200 text-green-700'
                        : 'border-red-200 text-red-700'
                    }>
                      {item.weight.toFixed(1)}%
                    </Badge>
                    {item.locked && allowLocking && (
                      <Badge variant="secondary" className="text-xs">Locked</Badge>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                  )}

                  {/* Weight Controls */}
                  <div className="space-y-3">
                    {/* Slider Control */}
                    {showSliders && !isReadOnly && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <Label>Weight</Label>
                          <span className="text-gray-500">
                            {item.minWeight || 0}% - {item.maxWeight || 100}%
                          </span>
                        </div>
                        <Slider
                          value={[item.weight]}
                          onValueChange={([value]) => updateItemWeight(index, value)}
                          min={item.minWeight || 0}
                          max={item.maxWeight || 100}
                          step={0.1}
                          className="w-full"
                          disabled={item.locked}
                        />
                      </div>
                    )}

                    {/* Input Control */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.weight}
                        onChange={(e) => updateItemWeight(index, parseFloat(e.target.value) || 0)}
                        min={item.minWeight || 0}
                        max={item.maxWeight || 100}
                        step={0.1}
                        className="w-20"
                        disabled={isReadOnly || item.locked}
                      />
                      <span className="text-sm text-gray-500">%</span>

                      {/* Lock/Unlock Button */}
                      {allowLocking && !isReadOnly && (
                        <Button
                          variant={item.locked ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleItemLock(index)}
                          className="flex items-center gap-1"
                        >
                          {item.locked ? "🔒" : "🔓"}
                        </Button>
                      )}
                    </div>

                    {/* Weight Progress Bar */}
                    <div className="space-y-1">
                      <Progress 
                        value={(item.weight / targetTotal) * 100} 
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span className="font-medium">
                          {((item.weight / targetTotal) * 100).toFixed(1)}% of total
                        </span>
                        <span>{targetTotal}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Auto-normalize Toggle */}
        {!isReadOnly && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-normalize weights</Label>
                <p className="text-xs text-gray-600">
                  Automatically adjust weights when items are added or removed
                </p>
              </div>
              <Button
                variant={autoNormalizeEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoNormalizeEnabled(!autoNormalizeEnabled)}
              >
                {autoNormalizeEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeightingSystem; 