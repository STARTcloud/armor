import axios from "axios";

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

// Authentication API functions
export const getAuthMethods = async (params = {}) => {
  const response = await api.get("/auth/methods", { params });
  return response.data;
};

export const loginBasic = async (username, password) => {
  const response = await api.post("/auth/login/basic", { username, password });
  return response.data;
};

export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

export const getAuthStatus = async () => {
  const response = await api.get("/auth/status");
  return response.data;
};

// File management API functions
export const getFiles = async (path = "/") => {
  const response = await api.get(path, {
    headers: { Accept: "application/json" },
  });
  return response.data;
};

export const uploadFile = async (path, file, onProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  });
  return response.data;
};

export const deleteFile = async (filePath) => {
  const response = await api.delete(filePath);
  return response.data;
};

export const createFolder = async (path, folderName) => {
  const response = await api.post(`${path}folders`, { folderName });
  return response.data;
};

export const renameFile = async (filePath, newName) => {
  const response = await api.put(`${filePath}?action=rename`, { newName });
  return response.data;
};

export const searchFiles = async (path, searchParams) => {
  const response = await api.post(`${path}search`, searchParams);
  return response.data;
};

// API Key management functions
export const getApiKeys = async () => {
  const response = await api.get("/api/api-keys");
  return response.data;
};

export const createApiKey = async (keyData) => {
  const response = await api.post("/api/api-keys", keyData);
  return response.data;
};

export const updateApiKey = async (keyId, updateData) => {
  const response = await api.put(`/api/api-keys/${keyId}`, updateData);
  return response.data;
};

export const deleteApiKey = async (keyId) => {
  const response = await api.delete(`/api/api-keys/${keyId}`);
  return response.data;
};

export default api;
