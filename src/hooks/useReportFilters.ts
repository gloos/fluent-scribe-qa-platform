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
}

export interface ReportData {
  id: string;
  name: string;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'error';
  segments: number;
  errors: number;
  score: number;
  language: string;
  processingTime?: number;
  fileSize?: number;
  reportType: string;
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
  status: ['processing', 'completed', 'error'],
};

// Mock data that will be filtered
const mockReportData: ReportData[] = [
  {
    id: '1',
    name: 'product_catalog_en_de.xliff',
    uploadedAt: '2024-01-15T10:30:00Z',
    status: 'completed',
    segments: 245,
    errors: 8,
    score: 8.9,
    language: 'EN → DE',
    processingTime: 3.2,
    fileSize: 2.4,
    reportType: 'xliff',
  },
  {
    id: '2',
    name: 'user_manual_fr_en.xliff',
    uploadedAt: '2024-01-15T09:15:00Z',
    status: 'processing',
    segments: 567,
    errors: 0,
    score: 0,
    language: 'FR → EN',
    fileSize: 4.1,
    reportType: 'xliff',
  },
  {
    id: '3',
    name: 'marketing_copy_es_en.mxliff',
    uploadedAt: '2024-01-14T16:45:00Z',
    status: 'completed',
    segments: 123,
    errors: 3,
    score: 9.2,
    language: 'ES → EN',
    processingTime: 2.1,
    fileSize: 1.8,
    reportType: 'mxliff',
  },
  {
    id: '4',
    name: 'legal_docs_de_en.xliff',
    uploadedAt: '2024-01-14T14:20:00Z',
    status: 'completed',
    segments: 789,
    errors: 23,
    score: 7.8,
    language: 'DE → EN',
    processingTime: 6.8,
    fileSize: 5.2,
    reportType: 'xliff',
  },
  {
    id: '5',
    name: 'technical_manual_ja_en.tmx',
    uploadedAt: '2024-01-13T11:30:00Z',
    status: 'completed',
    segments: 456,
    errors: 12,
    score: 8.5,
    language: 'JA → EN',
    processingTime: 4.5,
    fileSize: 3.2,
    reportType: 'tmx',
  },
  {
    id: '6',
    name: 'website_content_zh_en.xliff',
    uploadedAt: '2024-01-12T15:20:00Z',
    status: 'error',
    segments: 234,
    errors: 0,
    score: 0,
    language: 'ZH → EN',
    fileSize: 2.8,
    reportType: 'xliff',
  },
];

export const useReportFilters = () => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isFiltering, setIsFiltering] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<FilterState | null>(null);

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
    let filtered = [...mockReportData];

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

    // Report type filter
    if (filters.reportType !== 'all') {
      filtered = filtered.filter(item => item.reportType === filters.reportType);
    }

    // Language filter
    if (filters.languageFilter !== 'all') {
      const languageMap = {
        'en-de': 'EN → DE',
        'fr-en': 'FR → EN',
        'es-en': 'ES → EN',
        'de-en': 'DE → EN',
        'ja-en': 'JA → EN',
        'zh-en': 'ZH → EN',
      };
      const targetLanguage = languageMap[filters.languageFilter as keyof typeof languageMap];
      if (targetLanguage) {
        filtered = filtered.filter(item => item.language === targetLanguage);
      }
    }

    // Score range filter
    filtered = filtered.filter(item => 
      item.score >= filters.scoreRange[0] && 
      item.score <= filters.scoreRange[1]
    );

    // Status filter
    filtered = filtered.filter(item => 
      filters.status.includes(item.status)
    );

    // Processing time filter (only for completed files)
    filtered = filtered.filter(item => {
      if (item.status !== 'completed' || !item.processingTime) return true;
      return item.processingTime >= filters.processingTimeRange[0] && 
             item.processingTime <= filters.processingTimeRange[1];
    });

    return filtered;
  }, [filters]);

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
      count: Math.floor(item.count * (filteredData.length / mockReportData.length))
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
  }, [filteredData]);

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
    
    return mockReportData.filter(item => {
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
  }, [filteredData, filters.timeRange]);

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