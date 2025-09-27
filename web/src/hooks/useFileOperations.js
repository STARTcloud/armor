import { useState } from "react";

import api from "../utils/api";

const useFileOperations = ({ onSuccess, onError, onConfirmDelete }) => {
  const [loading, setLoading] = useState(false);

  const deleteFile = async (filePath) => {
    if (onConfirmDelete) {
      const confirmed = await onConfirmDelete(
        "Are you sure you want to delete this item?"
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      const apiPath =
        filePath === "/" ? "/api/files/" : `/api/files${filePath}`;
      await api.delete(apiPath);
      onSuccess?.();
    } catch (error) {
      console.error("Delete failed:", error);
      onError?.(error.response?.data?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const renameFile = async (filePath, newName) => {
    try {
      setLoading(true);
      const apiPath =
        filePath === "/" ? "/api/files/" : `/api/files${filePath}`;
      await api.put(`${apiPath}?action=rename`, {
        newName,
      });
      onSuccess?.();
    } catch (error) {
      console.error("Rename failed:", error);
      onError?.(error.response?.data?.message || "Rename failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async (currentPath, folderName) => {
    try {
      setLoading(true);
      const apiPath =
        currentPath === "/" ? "/api/files/" : `/api/files${currentPath}`;
      await api.post(`${apiPath}?action=create-folder`, { folderName });
      onSuccess?.();
    } catch (error) {
      console.error("Create folder failed:", error);
      onError?.(error.response?.data?.message || "Create folder failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteFile,
    renameFile,
    createFolder,
    loading,
  };
};

export default useFileOperations;
