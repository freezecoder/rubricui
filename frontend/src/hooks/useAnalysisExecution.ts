import { useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import { AnalysisExecution, AnalysisResults } from '@/types';

export const useAnalysisExecution = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<AnalysisExecution | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState('');

  const pollAnalysisStatus = useCallback(async (executionId: string, onComplete?: () => void) => {
    const pollInterval = setInterval(async () => {
      try {
        const execution = await apiService.getAnalysisExecution(executionId);
        setCurrentExecution(execution);
        
        if (execution.status === 'completed') {
          clearInterval(pollInterval);
          setIsRunning(false);
          
          // Load results
          const results = await apiService.getAnalysisResultsByExecution(executionId);
          setAnalysisResults(results);
          onComplete?.();
        } else if (execution.status === 'failed') {
          clearInterval(pollInterval);
          setIsRunning(false);
          const errorMessage = execution.error || 'Unknown error';
          setError(`Analysis failed: ${errorMessage}`);
          console.error('Analysis failed:', errorMessage);
        }
      } catch (err) {
        clearInterval(pollInterval);
        setIsRunning(false);
        setError('Failed to check analysis status');
        console.error(err);
      }
    }, 2000);
  }, []);

  const executeAnalysis = useCallback(async (
    projectId: string, 
    rubricId: string, 
    datasetId: string,
    onStart?: (execution: AnalysisExecution) => void,
    onComplete?: () => void
  ) => {
    try {
      setIsRunning(true);
      setError('');
      
      const execution = await apiService.executeAnalysisWithRubric(
        projectId,
        rubricId,
        datasetId
      );
      
      setCurrentExecution(execution);
      onStart?.(execution);
      
      // Start polling for status
      pollAnalysisStatus(execution.id, onComplete);
    } catch (err) {
      setError('Failed to start analysis');
      console.error(err);
      setIsRunning(false);
      throw err;
    }
  }, [pollAnalysisStatus]);

  const resetExecution = useCallback(() => {
    setIsRunning(false);
    setCurrentExecution(null);
    setAnalysisResults(null);
    setError('');
  }, []);

  return {
    isRunning,
    currentExecution,
    analysisResults,
    error,
    executeAnalysis,
    resetExecution
  };
};
