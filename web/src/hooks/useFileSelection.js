import { useState, useCallback } from "react";

const useFileSelection = (files) => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleSelectionChange = useCallback((filePath, isSelected) => {
    setSelectedFiles((prev) =>
      isSelected
        ? [...prev, filePath]
        : prev.filter((path) => path !== filePath)
    );
  }, []);

  const handleSelectAll = useCallback(
    (isSelected) => {
      setSelectedFiles(isSelected ? files.map((file) => file.path) : []);
    },
    [files]
  );

  const clearSelection = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  return {
    selectedFiles,
    handleSelectionChange,
    handleSelectAll,
    clearSelection,
    setSelectedFiles,
  };
};

export default useFileSelection;
