import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface DrillDownLevel {
  type: 'overview' | 'date' | 'language' | 'file' | 'segments';
  value: string;
  label: string;
  filters?: Record<string, any>;
}

export interface DrillDownSegment {
  id: string;
  session_id: string;
  segment_index: number;
  source_text: string;
  target_text: string;
  issue_type?: string;
  issue_severity?: string;
  issue_comment?: string;
  mqm_score: number;
  created_at: string;
}

export interface DrillDownData {
  reports?: any[];
  segments?: DrillDownSegment[];
  aggregatedData?: any;
  loading: boolean;
  error?: string;
}

export function useDrillDown() {
  const [navigationPath, setNavigationPath] = useState<DrillDownLevel[]>([
    { type: 'overview', value: 'all', label: 'All Reports' }
  ]);
  const [data, setData] = useState<DrillDownData>({ loading: false });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const drillDown = useCallback(async (level: DrillDownLevel) => {
    setData(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      let fetchedData: any = {};

      switch (level.type) {
        case 'date':
          // Fetch reports for specific date
          fetchedData = await fetchReportsByDate(level.value);
          break;
        case 'language':
          // Fetch reports for specific language
          fetchedData = await fetchReportsByLanguage(level.value);
          break;
        case 'file':
          // Fetch segments for specific file
          fetchedData = await fetchSegmentsByFile(level.value);
          break;
        case 'segments':
          // Already have segments, just filter/sort them
          fetchedData = { segments: data.segments };
          break;
      }

      setData(prev => ({ 
        ...prev, 
        ...fetchedData, 
        loading: false 
      }));
      
      setNavigationPath(prev => [...prev, level]);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Drill-down error:', error);
      setData(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to load drill-down data' 
      }));
    }
  }, [data.segments]);

  const navigateBack = useCallback(() => {
    if (navigationPath.length > 1) {
      const newPath = navigationPath.slice(0, -1);
      setNavigationPath(newPath);
      
      // If we're back to overview, close modal
      if (newPath.length === 1) {
        setIsModalOpen(false);
        setData({ loading: false });
      } else {
        // Re-fetch data for previous level
        const previousLevel = newPath[newPath.length - 1];
        drillDown(previousLevel);
      }
    }
  }, [navigationPath, drillDown]);

  const resetToOverview = useCallback(() => {
    setNavigationPath([{ type: 'overview', value: 'all', label: 'All Reports' }]);
    setIsModalOpen(false);
    setData({ loading: false });
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return {
    navigationPath,
    currentLevel: navigationPath[navigationPath.length - 1],
    data,
    isModalOpen,
    drillDown,
    navigateBack,
    resetToOverview,
    closeModal,
    canNavigateBack: navigationPath.length > 1,
  };
}

// Helper functions for data fetching
async function fetchReportsByDate(date: string) {
  const { data: sessions, error } = await supabase
    .from('qa_sessions')
    .select('*')
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { reports: sessions };
}

async function fetchReportsByLanguage(language: string) {
  const { data: sessions, error } = await supabase
    .from('qa_sessions')
    .select('*')
    .ilike('file_name', `%${language}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { reports: sessions };
}

async function fetchSegmentsByFile(sessionId: string) {
  const [sessionResult, segmentsResult] = await Promise.all([
    supabase
      .from('qa_sessions')
      .select('*')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('qa_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('segment_index', { ascending: true })
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (segmentsResult.error) throw segmentsResult.error;

  return { 
    reports: [sessionResult.data],
    segments: segmentsResult.data 
  };
} 