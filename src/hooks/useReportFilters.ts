import { useState, useMemo, useCallback, useEffect } from 'react';

export interface FilterState {
  timeRange: string;
  reportType: string;
  languageFilter: string;
  scoreRange: [number, number];
  dateRange: { from: Date | null; to: Date | null };
  fileSize: string;
  processingTimeRange: [number, number];
  status: string[];
  errorRange: [number, number];
  segmentRange: [number, number];
  modelFilter: string;
  fileSizeRange: [number, number];
  searchTerm: string;
}

export interface ReportData {
  id: string;
  name: string;
  uploadedAt: string;
  completedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  segments: number;
  errors: number;
  score: number;
  language: string;
  fileType: string;
  fileSize: number;
  modelUsed?: string;
  processingTime?: number;
}

export interface TrendData {
  value: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  changeText: string;
}

export interface SummaryStats {
  totalFiles: TrendData;
  processing: number;
  completed: number;
  totalSegments: TrendData;
  totalErrors: TrendData;
  avgScore: TrendData;
  avgProcessingTime: TrendData;
  totalLanguagePairs: TrendData;
  successRate: TrendData; // New: files with score >= 8
  errorRate: TrendData; // New: errors per segment
  dailyThroughput: TrendData; // New: files per day
  efficiencyRatio: TrendData; // New: segments per minute
}

export interface ChartData {
  reportsOverview: Array<{
    date: string;
    files: number;
    avgScore: number;
  }>;
  qualityDistribution: Array<{
    name: string;
    value: number;
    count: number;
  }>;
  issueAnalysis: Array<{
    category: string;
    count: number;
  }>;
  processingEfficiency: Array<{
    date: string;
    avgTime: number;
  }>;
}

const defaultFilters: FilterState = {
  timeRange: '7d',
  reportType: 'all',
  languageFilter: 'all',
  scoreRange: [0, 10],
  dateRange: { from: null, to: null },
  fileSize: 'all',
  processingTimeRange: [0, 60],
  status: ['processing', 'completed', 'failed', 'pending'],
  errorRange: [0, 1000],
  segmentRange: [0, 10000],
  modelFilter: 'all',
  fileSizeRange: [0, 100],
  searchTerm: '',
};

interface UseReportFiltersProps {
  data?: ReportData[];
  initialFilters?: Partial<FilterState>;
}

export const useReportFilters = (props: UseReportFiltersProps = {}) => {
  const { data = [], initialFilters } = props;
  
  // Merge default filters with initial filters
  const mergedInitialFilters = useMemo(() => ({
    ...defaultFilters,
    ...initialFilters,
  }), [initialFilters]);
  
  const [filters, setFilters] = useState<FilterState>(mergedInitialFilters);
  const [isFiltering, setIsFiltering] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<FilterState | null>(null);

  // Update filters when initialFilters change
  useEffect(() => {
    if (initialFilters) {
      const newFilters = { ...defaultFilters, ...initialFilters };
      setFilters(newFilters);
    }
  }, [initialFilters]);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setIsFiltering(true);
    const newFilters = { ...filters, ...updates };
    setPendingFilters(newFilters);
    
    // Debounce the actual filter application
    const timeoutId = setTimeout(() => {
      setFilters(newFilters);
      setPendingFilters(null);
      setIsFiltering(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  const resetFilters = () => {
    setIsFiltering(true);
    setFilters(defaultFilters);
    setPendingFilters(null);
    setTimeout(() => setIsFiltering(false), 100);
  };

  // Filter the data based on current filter state
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    
    let filtered = [...data];

    // Search term filter
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.language.toLowerCase().includes(searchLower) ||
        (item.modelUsed && item.modelUsed.toLowerCase().includes(searchLower))
      );
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRangeMap = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
      };
      
      const days = timeRangeMap[filters.timeRange as keyof typeof timeRangeMap];
      if (days) {
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(item => 
          new Date(item.uploadedAt) >= cutoffDate
        );
      }
    }

    // Custom date range filter (overrides timeRange if set)
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.uploadedAt);
        if (filters.dateRange.from && itemDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && itemDate > filters.dateRange.to) return false;
        return true;
      });
    }

    // Report type filter (file type)
    if (filters.reportType !== 'all') {
      filtered = filtered.filter(item => item.fileType === filters.reportType);
    }

    // Language filter
    if (filters.languageFilter !== 'all') {
      filtered = filtered.filter(item => item.language === filters.languageFilter);
    }

    // Score range filter
    filtered = filtered.filter(item => 
      item.score >= filters.scoreRange[0] && 
      item.score <= filters.scoreRange[1]
    );

    // Error range filter
    filtered = filtered.filter(item => 
      item.errors >= filters.errorRange[0] && 
      item.errors <= filters.errorRange[1]
    );

    // Segment range filter
    filtered = filtered.filter(item => 
      item.segments >= filters.segmentRange[0] && 
      item.segments <= filters.segmentRange[1]
    );

    // Status filter
    filtered = filtered.filter(item => 
      filters.status.includes(item.status)
    );

    // Model filter
    if (filters.modelFilter !== 'all') {
      filtered = filtered.filter(item => item.modelUsed === filters.modelFilter);
    }

    // File size range filter (convert bytes to MB)
    filtered = filtered.filter(item => {
      const fileSizeMB = item.fileSize / (1024 * 1024);
      return fileSizeMB >= filters.fileSizeRange[0] && 
             fileSizeMB <= filters.fileSizeRange[1];
    });

    // File size category filter
    if (filters.fileSize !== 'all') {
      filtered = filtered.filter(item => {
        const fileSizeMB = item.fileSize / (1024 * 1024);
        switch (filters.fileSize) {
          case 'small':
            return fileSizeMB < 2;
          case 'medium':
            return fileSizeMB >= 2 && fileSizeMB <= 5;
          case 'large':
            return fileSizeMB > 5;
          default:
            return true;
        }
      });
    }

    // Processing time filter (only for completed files)
    filtered = filtered.filter(item => {
      if (item.status !== 'completed' || !item.processingTime) return true;
      return item.processingTime >= filters.processingTimeRange[0] && 
             item.processingTime <= filters.processingTimeRange[1];
    });

    return filtered;
  }, [data, filters]);

  // Generate chart data from filtered data
  const chartData = useMemo((): ChartData => {
    const completedFiles = filteredData.filter(f => f.status === 'completed');
    
    // Reports Overview data (last 8 days)
    const reportsOverview = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (7 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      const dayFiles = filteredData.filter(f => 
        f.uploadedAt.startsWith(dateStr)
      );
      
      const avgScore = dayFiles.length > 0 
        ? dayFiles.reduce((sum, f) => sum + f.score, 0) / dayFiles.length 
        : 0;

      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        files: dayFiles.length,
        avgScore: Number(avgScore.toFixed(1)),
      };
    });

    // Quality Distribution
    const qualityDistribution = [
      {
        name: 'Excellent (9-10)',
        value: completedFiles.filter(f => f.score >= 9).length,
        count: completedFiles.filter(f => f.score >= 9).length,
      },
      {
        name: 'Good (7-8.9)',
        value: completedFiles.filter(f => f.score >= 7 && f.score < 9).length,
        count: completedFiles.filter(f => f.score >= 7 && f.score < 9).length,
      },
      {
        name: 'Needs Improvement (<7)',
        value: completedFiles.filter(f => f.score < 7).length,
        count: completedFiles.filter(f => f.score < 7).length,
      },
    ];

    // Issue Analysis
    const issueAnalysis = [
      { category: 'Grammar', count: Math.floor(Math.random() * 50) + 20 },
      { category: 'Terminology', count: Math.floor(Math.random() * 40) + 15 },
      { category: 'Spelling', count: Math.floor(Math.random() * 35) + 10 },
      { category: 'Style', count: Math.floor(Math.random() * 30) + 8 },
      { category: 'Formatting', count: Math.floor(Math.random() * 25) + 5 },
    ].map(item => ({
      ...item,
      count: Math.floor(item.count * (filteredData.length / data.length))
    }));

    // Processing Efficiency
    const processingEfficiency = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (7 - i));
      
      const dayFiles = completedFiles.filter(f => 
        f.uploadedAt.startsWith(date.toISOString().split('T')[0]) && f.processingTime
      );
      
      const avgTime = dayFiles.length > 0
        ? dayFiles.reduce((sum, f) => sum + (f.processingTime || 0), 0) / dayFiles.length
        : 4.5;

      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avgTime: Number(avgTime.toFixed(1)),
      };
    });

    return {
      reportsOverview,
      qualityDistribution,
      issueAnalysis,
      processingEfficiency,
    };
  }, [filteredData, data]);

  // Helper function to calculate trend data
  const calculateTrend = (current: number, previous: number, format: 'number' | 'decimal' | 'percentage' = 'number'): TrendData => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const direction: 'up' | 'down' | 'stable' = 
      Math.abs(change) < 0.1 ? 'stable' : change > 0 ? 'up' : 'down';
    
    let changeText = '';
    if (direction === 'stable') {
      changeText = 'No change';
    } else {
      const changeSymbol = direction === 'up' ? '+' : '';
      if (format === 'percentage') {
        changeText = `${changeSymbol}${change.toFixed(1)}%`;
      } else {
        changeText = `${changeSymbol}${change.toFixed(1)}%`;
      }
    }

    return {
      value: format === 'decimal' ? Number(current.toFixed(1)) : Math.round(current),
      change: Number(change.toFixed(1)),
      direction,
      changeText,
    };
  };

  // Helper function to get previous period data
  const getPreviousPeriodData = (timeRange: string) => {
    const now = new Date();
    const timeRangeMap = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    
    const days = timeRangeMap[timeRange as keyof typeof timeRangeMap] || 7;
    const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000);
    
    return data.filter(item => {
      const itemDate = new Date(item.uploadedAt);
      return itemDate >= previousPeriodStart && itemDate < currentPeriodStart;
    });
  };

  // Calculate summary statistics with trends
  const summaryStats = useMemo((): SummaryStats => {
    const completedFiles = filteredData.filter(f => f.status === 'completed');
    const processingFiles = filteredData.filter(f => f.status === 'processing');
    
    // Get previous period data for comparison
    const previousPeriodData = getPreviousPeriodData(filters.timeRange);
    const previousCompletedFiles = previousPeriodData.filter(f => f.status === 'completed');
    
    // Current period calculations
    const totalFiles = filteredData.length;
    const totalSegments = filteredData.reduce((sum, f) => sum + f.segments, 0);
    const totalErrors = completedFiles.reduce((sum, f) => sum + f.errors, 0);
    const avgScore = completedFiles.length > 0
      ? completedFiles.reduce((sum, f) => sum + f.score, 0) / completedFiles.length
      : 0;
    const avgProcessingTime = completedFiles.filter(f => f.processingTime).length > 0
      ? completedFiles
          .filter(f => f.processingTime)
          .reduce((sum, f) => sum + (f.processingTime || 0), 0) / 
         completedFiles.filter(f => f.processingTime).length
      : 0;
    const totalLanguagePairs = [...new Set(filteredData.map(f => f.language))].length;
    const successRate = completedFiles.length > 0
      ? (completedFiles.filter(f => f.score >= 8).length / completedFiles.length) * 100
      : 0;
    const errorRate = totalSegments > 0 ? (totalErrors / totalSegments) * 100 : 0;
    
    // Calculate daily throughput
    const timeRangeDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    const days = timeRangeDays[filters.timeRange as keyof typeof timeRangeDays] || 7;
    const dailyThroughput = totalFiles / days;
    
    // Calculate efficiency ratio (segments per minute)
    const totalProcessingTime = completedFiles
      .filter(f => f.processingTime)
      .reduce((sum, f) => sum + (f.processingTime || 0), 0);
    const efficiencyRatio = totalProcessingTime > 0 
      ? totalSegments / totalProcessingTime 
      : 0;
    
    // Previous period calculations
    const prevTotalFiles = previousPeriodData.length;
    const prevTotalSegments = previousPeriodData.reduce((sum, f) => sum + f.segments, 0);
    const prevTotalErrors = previousCompletedFiles.reduce((sum, f) => sum + f.errors, 0);
    const prevAvgScore = previousCompletedFiles.length > 0
      ? previousCompletedFiles.reduce((sum, f) => sum + f.score, 0) / previousCompletedFiles.length
      : 0;
    const prevAvgProcessingTime = previousCompletedFiles.filter(f => f.processingTime).length > 0
      ? previousCompletedFiles
          .filter(f => f.processingTime)
          .reduce((sum, f) => sum + (f.processingTime || 0), 0) / 
         previousCompletedFiles.filter(f => f.processingTime).length
      : 0;
    const prevTotalLanguagePairs = [...new Set(previousPeriodData.map(f => f.language))].length;
    const prevSuccessRate = previousCompletedFiles.length > 0
      ? (previousCompletedFiles.filter(f => f.score >= 8).length / previousCompletedFiles.length) * 100
      : 0;
    const prevErrorRate = prevTotalSegments > 0 ? (prevTotalErrors / prevTotalSegments) * 100 : 0;
    const prevDailyThroughput = prevTotalFiles / days;
    
    const prevTotalProcessingTime = previousCompletedFiles
      .filter(f => f.processingTime)
      .reduce((sum, f) => sum + (f.processingTime || 0), 0);
    const prevEfficiencyRatio = prevTotalProcessingTime > 0 
      ? prevTotalSegments / prevTotalProcessingTime 
      : 0;

    return {
      totalFiles: calculateTrend(totalFiles, prevTotalFiles),
      processing: processingFiles.length,
      completed: completedFiles.length,
      totalSegments: calculateTrend(totalSegments, prevTotalSegments),
      totalErrors: calculateTrend(totalErrors, prevTotalErrors),
      avgScore: calculateTrend(avgScore, prevAvgScore, 'decimal'),
      avgProcessingTime: calculateTrend(avgProcessingTime, prevAvgProcessingTime, 'decimal'),
      totalLanguagePairs: calculateTrend(totalLanguagePairs, prevTotalLanguagePairs),
      successRate: calculateTrend(successRate, prevSuccessRate, 'percentage'),
      errorRate: calculateTrend(errorRate, prevErrorRate, 'percentage'),
      dailyThroughput: calculateTrend(dailyThroughput, prevDailyThroughput, 'decimal'),
      efficiencyRatio: calculateTrend(efficiencyRatio, prevEfficiencyRatio, 'decimal'),
    };
  }, [filteredData, filters.timeRange, data]);

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    filteredData,
    chartData,
    summaryStats,
    isFiltering,
  };
}; 