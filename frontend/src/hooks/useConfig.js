/**
 * Hook for configuration management.
 */
import { useState, useEffect, useCallback } from 'react';
import { configAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';

export function useConfig() {
  const { state, dispatch } = useIndexing();
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  /**
   * Load current configuration from backend
   */
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await configAPI.getConfig();
      dispatch({
        type: 'SET_DIRECTORY',
        payload: response.data.directory,
      });
    } catch (error) {
      console.error('Failed to load config:', error);
      dispatch({
        type: 'ERROR',
        payload: error.response?.data?.detail || 'Failed to load configuration',
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Save directory configuration
   * @param {string} directory - Directory path to save
   */
  const saveConfig = useCallback(
    async (directory) => {
      setLoading(true);
      try {
        await configAPI.updateConfig(directory);
        dispatch({
          type: 'SET_DIRECTORY',
          payload: directory,
        });
        return { success: true };
      } catch (error) {
        console.error('Failed to save config:', error);
        const errorMessage = error.response?.data?.detail || 'Failed to save configuration';
        dispatch({
          type: 'ERROR',
          payload: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [dispatch]
  );

  /**
   * Validate a directory path
   * @param {string} path - Directory path to validate
   */
  const validateDirectory = useCallback(async (path) => {
    if (!path || !path.trim()) {
      setValidationResult({ valid: false, error: 'Path cannot be empty' });
      return;
    }

    try {
      const response = await configAPI.validateDirectory(path);
      setValidationResult(response.data);
    } catch (error) {
      console.error('Failed to validate directory:', error);
      setValidationResult({
        valid: false,
        error: error.response?.data?.detail || 'Validation failed',
      });
    }
  }, []);

  /**
   * Load config on mount
   */
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    directory: state.directory,
    loading,
    validationResult,
    loadConfig,
    saveConfig,
    validateDirectory,
  };
}
