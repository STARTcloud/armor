import { useState } from "react";

import api from "../utils/api";

/**
 * Custom hook for file operations with loading states and confirmations
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Called when operation succeeds
 * @param {Function} options.onError - Called when operation fails
 * @param {Function} options.onConfirmDelete - Called to confirm delete operations
 * @param {Function} options.onConfirmMove - Called to confirm move operations
 * @returns {Object} File operation functions and loading state
 */
const useFileOperations = ({
  onSuccess,
  onError,
  onConfirmDelete,
  onConfirmMove,
}) => {
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
      await api.post(`${apiPath}/folders`, { folderName });
      onSuccess?.();
    } catch (error) {
      console.error("Create folder failed:", error);
      onError?.(error.response?.data?.message || "Create folder failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteMultipleFiles = async (filePaths) => {
    if (onConfirmDelete) {
      const fileCount = filePaths.length;
      const confirmed = await onConfirmDelete(
        `Are you sure you want to delete ${fileCount} selected item${fileCount > 1 ? "s" : ""}?`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      await Promise.all(
        filePaths.map((filePath) => {
          const apiPath =
            filePath === "/" ? "/api/files/" : `/api/files${filePath}`;
          return api.delete(apiPath);
        })
      );
      onSuccess?.();
    } catch (error) {
      console.error("Delete multiple files failed:", error);
      onError?.(error.response?.data?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const moveFilesToParent = async (filePaths, currentPath) => {
    if (currentPath === "/" || currentPath === "") {
      onError?.("Cannot move files from root directory");
      return;
    }

    if (onConfirmMove) {
      const fileCount = filePaths.length;
      const confirmed = await onConfirmMove(
        `Are you sure you want to move ${fileCount} selected item${fileCount > 1 ? "s" : ""} to the parent directory?`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      const apiPath =
        currentPath === "/" ? "/api/files/" : `/api/files${currentPath}`;
      await api.put(`${apiPath}?action=move`, {
        filePaths,
      });
      onSuccess?.();
    } catch (error) {
      console.error("Move files failed:", error);
      onError?.(error.response?.data?.message || "Move failed");
    } finally {
      setLoading(false);
    }
  };

  const moveFilesToFolder = async (
    filePaths,
    destinationPath,
    destinationName
  ) => {
    if (onConfirmMove) {
      const fileCount = filePaths.length;
      const confirmed = await onConfirmMove(
        `Are you sure you want to move ${fileCount} selected item${fileCount > 1 ? "s" : ""} to the "${destinationName}" folder?`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      const apiPath =
        destinationPath === "/"
          ? "/api/files/"
          : `/api/files${destinationPath}`;
      await api.put(`${apiPath}?action=move`, {
        filePaths,
        destinationPath,
      });
      onSuccess?.();
    } catch (error) {
      console.error("Move files to folder failed:", error);
      onError?.(error.response?.data?.message || "Move failed");
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteFile,
    renameFile,
    createFolder,
    deleteMultipleFiles,
    moveFilesToParent,
    moveFilesToFolder,
    loading,
  };
};

export default useFileOperations;
