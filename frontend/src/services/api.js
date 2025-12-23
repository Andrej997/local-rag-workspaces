import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const configAPI = {
  getConfig: () => api.get('/config'),
  updateConfig: (directory) => api.post('/config', { directory }),
};

export const bucketAPI = {
  getBuckets: () => api.get('/buckets'),
  getCurrentBucket: () => api.get('/buckets/current'),
  createBucket: (name, config = {}) => api.post('/buckets', { name, config }),
  updateConfig: (name, config) => api.put(`/buckets/${name}/config`, config),
  selectBucket: (name) => api.post(`/buckets/${name}/select`),
  addDirectory: (bucketName, path) => api.post(`/buckets/${bucketName}/directories`, { path }),
  addDirectories: (bucketName, paths) => api.put(`/buckets/${bucketName}/directories`, { paths }),
  removeDirectory: (bucketName, path) => api.delete(`/buckets/${bucketName}/directories`, { data: { paths: [path] } }),
  removeDirectories: (bucketName, paths) => api.delete(`/buckets/${bucketName}/directories`, { data: { paths } }),
  deleteBucket: (name) => api.delete(`/buckets/${name}`),
  getFile: (bucketName, filePath) => api.get(`/buckets/${bucketName}/files/${filePath}`, { responseType: 'blob' }),
};

export const uploadAPI = {
  upload: (bucketName, formData, onProgress) => api.post(`/upload/${bucketName}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  }),
};

export const indexingAPI = {
  start: (bucketName) => api.post(`/indexing/start`, { bucket_name: bucketName }),
  stop: () => api.post('/indexing/stop'),
  getStatus: () => api.get('/indexing/status'),
};

export const searchAPI = {
  chat: (bucketName, query) => api.post('/search/', { bucket_name: bucketName, query }),
  getHistory: (bucketName) => api.get(`/search/history/${bucketName}`),
  clearHistory: (bucketName) => api.delete(`/search/history/${bucketName}`),
  getSessions: (bucketName) => api.get(`/search/sessions/${bucketName}`),
  createNewSession: (bucketName) => api.post(`/search/sessions/${bucketName}/new`),
  loadSession: (bucketName, sessionId) => api.get(`/search/sessions/${bucketName}/${sessionId}`),
};

export const visualizationAPI = {
  // Support 'dim' parameter (default 2)
  getData: (bucketName, dim = 2) => api.get(`/visualization/${bucketName}`, { params: { dim } }),
};

export const browseAPI = {
  browse: (path, navigate) => api.post('/browse', { path, navigate }),
};

export const statsAPI = {
  getStats: () => api.get('/stats'),
  getSpaceStats: (bucketName) => api.get(`/stats/space/${bucketName}`),
  getServiceHealth: () => api.get('/stats/health'),
  getOllamaModels: () => api.get('/stats/ollama/models'),
};

export const metadataAPI = {
  getCollections: () => api.get('/metadata/collections'),
  getCollectionMetadata: (collectionName) => api.get(`/metadata/collection/${collectionName}`),
};

export const scrapingAPI = {
  scrape: (url, bucketName) => api.post('/scraping/scrape', { url, bucket_name: bucketName }),
  save: (bucketName, url, pdfData) => api.post('/scraping/save', {
    bucket_name: bucketName,
    url,
    pdf_data: pdfData
  }),
};

export default api;