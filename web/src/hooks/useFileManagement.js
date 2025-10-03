import { useCallback } from "react";

const useFileManagement = (
  currentPath,
  deleteMultipleFiles,
  moveFilesToParent,
  moveFilesToFolder,
  setError
) => {
  const handleDeleteSelected = useCallback(
    async (selectedFiles) => {
      if (selectedFiles.length === 0) {
        return;
      }
      try {
        await deleteMultipleFiles(selectedFiles);
      } catch (err) {
        setError(err.message);
      }
    },
    [deleteMultipleFiles, setError]
  );

  const handleMoveToParent = useCallback(
    async (selectedFiles) => {
      if (selectedFiles.length === 0 || currentPath === "/") {
        return;
      }
      try {
        await moveFilesToParent(selectedFiles, currentPath);
      } catch (err) {
        setError(err.message);
      }
    },
    [currentPath, moveFilesToParent, setError]
  );

  const handleMoveToFolder = useCallback(
    async (selectedFiles, destinationPath, destinationName) => {
      if (selectedFiles.length === 0) {
        return;
      }
      try {
        await moveFilesToFolder(
          selectedFiles,
          destinationPath,
          destinationName
        );
      } catch (err) {
        setError(err.message);
      }
    },
    [moveFilesToFolder, setError]
  );

  return {
    handleDeleteSelected,
    handleMoveToParent,
    handleMoveToFolder,
  };
};

export default useFileManagement;
