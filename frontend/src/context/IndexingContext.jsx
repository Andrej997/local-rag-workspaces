import { createContext, useContext, useReducer, useEffect } from 'react';
import { bucketAPI } from '../services/api';

const IndexingContext = createContext();

const initialState = {
  // Bucket Management State
  buckets: [],
  currentBucket: null,
  
  // Indexing Progress State
  isIndexing: false,
  progress: {
    filesTotal: 0,
    filesProcessed: 0,
    currentFile: '',
    chunksTotal: 0,
    percentage: 0,
  },
  error: null,
  lastCompleted: null,
  connectionStatus: 'disconnected', 
};

const indexingReducer = (state, action) => {
  switch (action.type) {
    // --- Bucket Actions ---
    case 'SET_BUCKETS':
      return { ...state, buckets: action.payload };
    case 'SET_CURRENT_BUCKET':
      return { ...state, currentBucket: action.payload };
      
    // --- Indexing Actions ---
    case 'INDEXING_STARTED':
      return {
        ...state,
        isIndexing: true,
        error: null,
        progress: {
          filesTotal: 0,
          filesProcessed: 0,
          currentFile: '',
          chunksTotal: 0,
          percentage: 0,
        },
      };

    case 'PROGRESS_UPDATE':
      return {
        ...state,
        progress: {
          ...state.progress,
          ...action.payload,
        },
      };

    case 'INDEXING_COMPLETE':
      return {
        ...state,
        isIndexing: false,
        lastCompleted: Date.now(),
        progress: {
          ...state.progress,
          percentage: 100,
        },
      };

    case 'INDEXING_STOPPED':
      return {
        ...state,
        isIndexing: false,
      };

    case 'ERROR':
      return {
        ...state,
        error: action.payload,
        isIndexing: false,
      };

    case 'CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload,
      };

    default:
      return state;
  }
};

export function IndexingProvider({ children }) {
  const [state, dispatch] = useReducer(indexingReducer, initialState);

  // Helper to refresh the bucket list and current selection
  const refreshBuckets = async () => {
    try {
      const [bucketsRes, currentRes] = await Promise.all([
        bucketAPI.getBuckets(),
        bucketAPI.getCurrentBucket().catch(() => ({ data: null }))
      ]);
      
      dispatch({ type: 'SET_BUCKETS', payload: bucketsRes.data });
      
      if (currentRes.data) {
        dispatch({ type: 'SET_CURRENT_BUCKET', payload: currentRes.data });
      } else if (bucketsRes.data.length > 0) {
        // Fallback: select first bucket if none active
        await bucketAPI.selectBucket(bucketsRes.data[0].name);
        dispatch({ type: 'SET_CURRENT_BUCKET', payload: bucketsRes.data[0] });
      }
    } catch (err) {
      console.error("Failed to load buckets:", err);
    }
  };

  // Alias for backward compatibility if some components use 'refreshBucket' (singular)
  const refreshBucket = refreshBuckets;

  // Initial Load
  useEffect(() => {
    refreshBuckets();
  }, []);

  return (
    <IndexingContext.Provider value={{ state, dispatch, refreshBuckets, refreshBucket }}>
      {children}
    </IndexingContext.Provider>
  );
}

export function useIndexing() {
  const context = useContext(IndexingContext);
  if (!context) {
    throw new Error('useIndexing must be used within an IndexingProvider');
  }
  return context;
}