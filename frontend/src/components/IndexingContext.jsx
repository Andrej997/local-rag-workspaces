import { createContext, useContext, useReducer, useEffect } from 'react';
import { bucketAPI, indexingAPI } from '../services/api';

const IndexingContext = createContext();

const initialState = {
  buckets: [],
  currentBucket: null,
  indexingStatus: { is_running: false, progress: null },
};

function indexingReducer(state, action) {
  switch (action.type) {
    case 'SET_BUCKETS':
      return { ...state, buckets: action.payload };
    case 'SET_CURRENT_BUCKET':
      return { ...state, currentBucket: action.payload };
    case 'UPDATE_STATUS':
      return { ...state, indexingStatus: action.payload };
    default:
      return state;
  }
}

export function IndexingProvider({ children }) {
  const [state, dispatch] = useReducer(indexingReducer, initialState);

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
        // Fallback: select first bucket if none selected
        await bucketAPI.selectBucket(bucketsRes.data[0].name);
        dispatch({ type: 'SET_CURRENT_BUCKET', payload: bucketsRes.data[0] });
      }
    } catch (err) {
      console.error("Failed to load buckets:", err);
    }
  };

  // Initial Load
  useEffect(() => {
    refreshBuckets();
  }, []);

  return (
    <IndexingContext.Provider value={{ state, dispatch, refreshBuckets }}>
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