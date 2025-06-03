/**
 * Scoring Model Weight Management Utilities
 * 
 * Extends the existing MQM weighting system to support custom scoring models
 * with flexible weight management, validation, and normalization.
 */

import type { ScoringModelDimension, ScoringModelErrorType } from '@/lib/types/scoring-models';
import type { ErrorSeverity } from '@/lib/types/assessment';
import { normalizeWeights } from '@/lib/constants/mqm-weighting-profiles';
import type { WeightedItem } from '@/components/scoring/WeightingSystem';

/**
 * Weight validation result for scoring models
 */
export interface ScoringModelWeightValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dimensionTotal: number;
  errorTypeTotal: number;
  recommendations: string[];
}

/**
 * Weight distribution summary
 */
export interface WeightDistributionSummary {
  totalWeight: number;
  weightedItems: number;
  averageWeight: number;
  maxWeight: number;
  minWeight: number;
  standardDeviation: number;
  isBalanced: boolean;
  unbalancedBy: number;
}

/**
 * Auto-balance configuration
 */
export interface AutoBalanceConfig {
  respectLocks?: boolean;
  respectMinMax?: boolean;
  targetTotal?: number;
  preserveProportions?: boolean;
  roundToDecimals?: number;
}

/**
 * Convert scoring model dimensions to weighted items
 */
export function dimensionsToWeightedItems(dimensions: ScoringModelDimension[]): WeightedItem[] {
  return dimensions.map(dimension => ({
    id: dimension.id,
    name: dimension.name,
    weight: dimension.weight,
    description: dimension.description,
    locked: false,
    minWeight: 0,
    maxWeight: 100
  }));
}

/**
 * Convert scoring model error types to weighted items
 */
export function errorTypesToWeightedItems(errorTypes: ScoringModelErrorType[]): WeightedItem[] {
  return errorTypes.map(errorType => ({
    id: errorType.id,
    name: errorType.type,
    weight: errorType.weight,
    description: errorType.description,
    locked: false,
    minWeight: 0,
    maxWeight: 100
  }));
}

/**
 * Convert weighted items back to dimensions
 */
export function weightedItemsToDimensions(
  weightedItems: WeightedItem[], 
  originalDimensions: ScoringModelDimension[]
): ScoringModelDimension[] {
  return weightedItems.map(item => {
    const original = originalDimensions.find(dim => dim.id === item.id);
    return {
      id: item.id,
      name: item.name,
      weight: item.weight,
      description: item.description || original?.description,
      subcriteria: original?.subcriteria || []
    };
  });
}

/**
 * Convert weighted items back to error types
 */
export function weightedItemsToErrorTypes(
  weightedItems: WeightedItem[], 
  originalErrorTypes: ScoringModelErrorType[]
): ScoringModelErrorType[] {
  return weightedItems.map(item => {
    const original = originalErrorTypes.find(error => error.id === item.id);
    return {
      id: item.id,
      type: item.name,
      weight: item.weight,
      description: item.description || original?.description,
      severity: original?.severity || 'minor' as ErrorSeverity
    };
  });
}

/**
 * Validate scoring model weights
 */
export function validateScoringModelWeights(
  dimensions: ScoringModelDimension[],
  errorTypes: ScoringModelErrorType[],
  targetTotal: number = 100
): ScoringModelWeightValidation {
  const result: ScoringModelWeightValidation = {
    isValid: true,
    errors: [],
    warnings: [],
    dimensionTotal: 0,
    errorTypeTotal: 0,
    recommendations: []
  };

  // Calculate totals
  result.dimensionTotal = dimensions.reduce((sum, dim) => sum + dim.weight, 0);
  result.errorTypeTotal = errorTypes.reduce((sum, error) => sum + error.weight, 0);

  // Validate dimension weights
  if (dimensions.length > 0) {
    if (Math.abs(result.dimensionTotal - targetTotal) > 0.01) {
      result.errors.push(
        `Dimension weights total ${result.dimensionTotal.toFixed(1)}% (should be ${targetTotal}%)`
      );
      result.isValid = false;
    }

    // Check for negative weights
    dimensions.forEach(dim => {
      if (dim.weight < 0) {
        result.errors.push(`Dimension "${dim.name}" has negative weight: ${dim.weight}%`);
        result.isValid = false;
      }
    });

    // Check for zero weights
    const zeroWeightDimensions = dimensions.filter(dim => dim.weight === 0);
    if (zeroWeightDimensions.length > 0) {
      result.warnings.push(
        `${zeroWeightDimensions.length} dimension(s) have zero weight: ${zeroWeightDimensions.map(d => d.name).join(', ')}`
      );
    }

    // Check for extremely high weights
    const highWeightDimensions = dimensions.filter(dim => dim.weight > 50);
    if (highWeightDimensions.length > 0) {
      result.warnings.push(
        `Some dimensions have very high weights (>50%): ${highWeightDimensions.map(d => `${d.name} (${d.weight}%)`).join(', ')}`
      );
    }
  }

  // Validate error type weights
  if (errorTypes.length > 0) {
    if (Math.abs(result.errorTypeTotal - targetTotal) > 0.01) {
      result.errors.push(
        `Error type weights total ${result.errorTypeTotal.toFixed(1)}% (should be ${targetTotal}%)`
      );
      result.isValid = false;
    }

    // Check for negative weights
    errorTypes.forEach(error => {
      if (error.weight < 0) {
        result.errors.push(`Error type "${error.type}" has negative weight: ${error.weight}%`);
        result.isValid = false;
      }
    });

    // Check for zero weights
    const zeroWeightErrors = errorTypes.filter(error => error.weight === 0);
    if (zeroWeightErrors.length > 0) {
      result.warnings.push(
        `${zeroWeightErrors.length} error type(s) have zero weight: ${zeroWeightErrors.map(e => e.type).join(', ')}`
      );
    }
  }

  // Generate recommendations
  if (dimensions.length === 0 && errorTypes.length === 0) {
    result.recommendations.push('Add at least one dimension or error type to create a functional scoring model');
  } else if (dimensions.length === 0) {
    result.recommendations.push('Consider adding quality dimensions for more comprehensive assessment');
  } else if (errorTypes.length === 0) {
    result.recommendations.push('Consider adding error types for more detailed penalty calculation');
  }

  if (result.dimensionTotal > 0 && result.dimensionTotal !== targetTotal) {
    result.recommendations.push('Use the "Balance" or "Normalize" buttons to automatically adjust dimension weights');
  }

  if (result.errorTypeTotal > 0 && result.errorTypeTotal !== targetTotal) {
    result.recommendations.push('Use the "Balance" or "Normalize" buttons to automatically adjust error type weights');
  }

  return result;
}

/**
 * Get weight distribution summary
 */
export function getWeightDistributionSummary(
  items: WeightedItem[],
  targetTotal: number = 100
): WeightDistributionSummary {
  if (items.length === 0) {
    return {
      totalWeight: 0,
      weightedItems: 0,
      averageWeight: 0,
      maxWeight: 0,
      minWeight: 0,
      standardDeviation: 0,
      isBalanced: false,
      unbalancedBy: targetTotal
    };
  }

  const weights = items.map(item => item.weight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const averageWeight = totalWeight / items.length;
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);

  // Calculate standard deviation
  const variance = weights.reduce((sum, weight) => 
    sum + Math.pow(weight - averageWeight, 2), 0
  ) / items.length;
  const standardDeviation = Math.sqrt(variance);

  const isBalanced = Math.abs(totalWeight - targetTotal) < 0.01;
  const unbalancedBy = Math.abs(totalWeight - targetTotal);

  return {
    totalWeight,
    weightedItems: items.length,
    averageWeight,
    maxWeight,
    minWeight,
    standardDeviation,
    isBalanced,
    unbalancedBy
  };
}

/**
 * Auto-balance weights with advanced options
 */
export function autoBalanceWeights(
  items: WeightedItem[],
  config: AutoBalanceConfig = {}
): WeightedItem[] {
  const {
    respectLocks = true,
    respectMinMax = true,
    targetTotal = 100,
    preserveProportions = false,
    roundToDecimals = 1
  } = config;

  if (items.length === 0) return items;

  const lockedItems = respectLocks ? items.filter(item => item.locked) : [];
  const unlockedItems = respectLocks ? items.filter(item => !item.locked) : items;

  if (unlockedItems.length === 0) return items;

  const lockedTotal = lockedItems.reduce((sum, item) => sum + item.weight, 0);
  const availableWeight = Math.max(0, targetTotal - lockedTotal);

  let balancedItems: WeightedItem[];

  if (preserveProportions && unlockedItems.some(item => item.weight > 0)) {
    // Preserve proportions among unlocked items
    const unlockedTotal = unlockedItems.reduce((sum, item) => sum + item.weight, 0);
    const scaleFactor = unlockedTotal > 0 ? availableWeight / unlockedTotal : 1;

    balancedItems = items.map(item => {
      if (respectLocks && item.locked) return item;

      let newWeight = item.weight * scaleFactor;

      // Respect min/max constraints
      if (respectMinMax) {
        newWeight = Math.min(Math.max(newWeight, item.minWeight || 0), item.maxWeight || 100);
      }

      return {
        ...item,
        weight: Math.round(newWeight * Math.pow(10, roundToDecimals)) / Math.pow(10, roundToDecimals)
      };
    });
  } else {
    // Equal distribution among unlocked items
    const weightPerItem = availableWeight / unlockedItems.length;

    balancedItems = items.map(item => {
      if (respectLocks && item.locked) return item;

      let newWeight = weightPerItem;

      // Respect min/max constraints
      if (respectMinMax) {
        newWeight = Math.min(Math.max(newWeight, item.minWeight || 0), item.maxWeight || 100);
      }

      return {
        ...item,
        weight: Math.round(newWeight * Math.pow(10, roundToDecimals)) / Math.pow(10, roundToDecimals)
      };
    });
  }

  // If min/max constraints prevent perfect balance, redistribute excess
  const currentTotal = balancedItems.reduce((sum, item) => sum + item.weight, 0);
  const excess = currentTotal - targetTotal;

  if (Math.abs(excess) > 0.01 && respectMinMax) {
    const adjustableItems = balancedItems.filter(item => 
      (!respectLocks || !item.locked) && 
      ((excess > 0 && item.weight > (item.minWeight || 0)) ||
       (excess < 0 && item.weight < (item.maxWeight || 100)))
    );

    if (adjustableItems.length > 0) {
      const adjustmentPerItem = -excess / adjustableItems.length;

      balancedItems = balancedItems.map(item => {
        if (!adjustableItems.includes(item)) return item;

        let newWeight = item.weight + adjustmentPerItem;
        newWeight = Math.min(Math.max(newWeight, item.minWeight || 0), item.maxWeight || 100);

        return {
          ...item,
          weight: Math.round(newWeight * Math.pow(10, roundToDecimals)) / Math.pow(10, roundToDecimals)
        };
      });
    }
  }

  return balancedItems;
}

/**
 * Normalize weights using the existing MQM utility
 */
export function normalizeScoringModelWeights<T extends { weight: number }>(
  items: T[],
  targetTotal: number = 100
): T[] {
  if (items.length === 0) return items;

  const weights = items.reduce((acc, item, index) => {
    acc[index] = item.weight;
    return acc;
  }, {} as Record<number, number>);

  const normalizedWeights = normalizeWeights(weights, targetTotal);

  return items.map((item, index) => ({
    ...item,
    weight: Math.round(normalizedWeights[index] * 100) / 100
  }));
}

/**
 * Redistribute weights when items are added or removed
 */
export function redistributeWeightsOnChange(
  oldItems: WeightedItem[],
  newItems: WeightedItem[],
  targetTotal: number = 100
): WeightedItem[] {
  if (newItems.length === 0) return newItems;

  // If items were added
  if (newItems.length > oldItems.length) {
    const addedItems = newItems.filter(item => 
      !oldItems.some(oldItem => oldItem.id === item.id)
    );

    // Give new items equal weight from available space
    const existingTotal = newItems.filter(item => 
      oldItems.some(oldItem => oldItem.id === item.id)
    ).reduce((sum, item) => sum + item.weight, 0);

    const availableWeight = Math.max(0, targetTotal - existingTotal);
    const weightPerNewItem = addedItems.length > 0 ? availableWeight / addedItems.length : 0;

    return newItems.map(item => {
      if (addedItems.includes(item)) {
        return { ...item, weight: Math.round(weightPerNewItem * 100) / 100 };
      }
      return item;
    });
  }

  // If items were removed, redistribute their weight among remaining items
  if (newItems.length < oldItems.length) {
    const removedItems = oldItems.filter(item => 
      !newItems.some(newItem => newItem.id === item.id)
    );

    const removedWeight = removedItems.reduce((sum, item) => sum + item.weight, 0);
    const redistributionPerItem = newItems.length > 0 ? removedWeight / newItems.length : 0;

    return newItems.map(item => ({
      ...item,
      weight: Math.round((item.weight + redistributionPerItem) * 100) / 100
    }));
  }

  // Same number of items, just return as-is
  return newItems;
}

/**
 * Calculate weight impact when changing a single item
 */
export function calculateWeightImpact(
  items: WeightedItem[],
  changedIndex: number,
  newWeight: number,
  autoDistribute: boolean = false,
  targetTotal: number = 100
): {
  updatedItems: WeightedItem[];
  impact: {
    totalChange: number;
    affectedItems: number;
    newTotal: number;
    isBalanced: boolean;
  };
} {
  const currentWeight = items[changedIndex]?.weight || 0;
  const weightDifference = newWeight - currentWeight;

  let updatedItems = items.map((item, index) => 
    index === changedIndex ? { ...item, weight: newWeight } : item
  );

  if (autoDistribute && Math.abs(weightDifference) > 0.01) {
    const otherItems = items.filter((_, index) => index !== changedIndex);
    
    if (otherItems.length > 0) {
      const adjustmentPerOther = -weightDifference / otherItems.length;
      
      updatedItems = updatedItems.map((item, index) => {
        if (index === changedIndex) return item;
        
        const newItemWeight = Math.max(0, item.weight + adjustmentPerOther);
        return { ...item, weight: Math.round(newItemWeight * 100) / 100 };
      });
    }
  }

  const newTotal = updatedItems.reduce((sum, item) => sum + item.weight, 0);
  const isBalanced = Math.abs(newTotal - targetTotal) < 0.01;

  return {
    updatedItems,
    impact: {
      totalChange: weightDifference,
      affectedItems: autoDistribute ? items.length : 1,
      newTotal,
      isBalanced
    }
  };
} 