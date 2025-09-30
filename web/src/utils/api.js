import axios from "axios";

/**
 * Configured axios instance for API calls
 * Includes base URL, credentials, and JSON headers
 */
const api = axios.create({
  baseURL: window.location.origin,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

/**
 * Gets available authentication methods
 * @param {Object} params - Query parameters for filtering auth methods
 * @returns {Promise<Object>} Authentication methods configuration
 */
export const getAuthMethods = async (params = {}) => {
  const response = await api.get("/auth/methods", { params });
  return response.data;
};

/**
 * Authenticates user with username/password
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} Authentication response
 */
export const loginBasic = async (username, password) => {
  const response = await api.post("/auth/login/basic", { username, password });
  return response.data;
};

/**
 * Logs out current user
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

/**
 * Gets current authentication status
 * @returns {Promise<Object>} Authentication status
 */
export const getAuthStatus = async () => {
  const response = await api.get("/auth/status");
  return response.data;
};

/**
 * Gets files and directories for specified path
 * @param {string} path - Directory path to list
 * @returns {Promise<Object>} Files and directory information
 */
export const getFiles = async (path = "/") => {
  const response = await api.get(path, {
    headers: { Accept: "application/json" },
  });
  return response.data;
};

/**
 * Uploads file to specified path with progress tracking
 * @param {string} path - Upload destination path
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Upload response
 */
export const uploadFile = async (path, file, onProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  });
  return response.data;
};

/**
 * Deletes file or directory
 * @param {string} filePath - Path to file/directory to delete
 * @returns {Promise<Object>} Deletion response
 */
export const deleteFile = async (filePath) => {
  const response = await api.delete(filePath);
  return response.data;
};

/**
 * Creates new folder at specified path
 * @param {string} path - Parent directory path
 * @param {string} folderName - Name of new folder
 * @returns {Promise<Object>} Creation response
 */
export const createFolder = async (path, folderName) => {
  const response = await api.post(`${path}folders`, { folderName });
  return response.data;
};

/**
 * Renames file or directory
 * @param {string} filePath - Path to file/directory to rename
 * @param {string} newName - New name for the file/directory
 * @returns {Promise<Object>} Rename response
 */
export const renameFile = async (filePath, newName) => {
  const response = await api.put(`${filePath}?action=rename`, { newName });
  return response.data;
};

/**
 * Searches files and checksums
 * @param {string} path - Search path
 * @param {Object} searchParams - Search parameters (query, page, limit)
 * @returns {Promise<Object>} Search results
 */
export const searchFiles = async (path, searchParams) => {
  const response = await api.post(`${path}search`, searchParams);
  return response.data;
};

/**
 * Gets all API keys for current user
 * @returns {Promise<Object>} API keys data
 */
export const getApiKeys = async () => {
  const response = await api.get("/api/api-keys");
  return response.data;
};

/**
 * Creates new API key
 * @param {Object} keyData - API key configuration (name, permissions, expires_at)
 * @returns {Promise<Object>} Created API key data
 */
export const createApiKey = async (keyData) => {
  const response = await api.post("/api/api-keys", keyData);
  return response.data;
};

/**
 * Updates existing API key
 * @param {string} keyId - API key ID
 * @param {Object} updateData - Updated key data
 * @returns {Promise<Object>} Update response
 */
export const updateApiKey = async (keyId, updateData) => {
  const response = await api.put(`/api/api-keys/${keyId}`, updateData);
  return response.data;
};

/**
 * Deletes API key
 * @param {string} keyId - API key ID to delete
 * @returns {Promise<Object>} Deletion response
 */
export const deleteApiKey = async (keyId) => {
  const response = await api.delete(`/api/api-keys/${keyId}`);
  return response.data;
};

export default api;
