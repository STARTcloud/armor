import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import useConfirmation from "../../hooks/useConfirmation";
import useFileLoader from "../../hooks/useFileLoader";
import useFileManagement from "../../hooks/useFileManagement";
import useFileManagerSSE from "../../hooks/useFileManagerSSE";
import useFileOperations from "../../hooks/useFileOperations";
import useFileSearch from "../../hooks/useFileSearch";
import useFileSelection from "../../hooks/useFileSelection";
import { useAuth } from "../auth/AuthContext";

import FileManagerUI from "./FileManagerUI";

const FileManager = () => {
  const location = useLocation();
  const { t } = useTranslation(["files", "common"]);
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [checksumProgress, setChecksumProgress] = useState(null);

  const getCurrentPath = () => {
    const { pathname } = location;
    return pathname === "/" ? "/" : pathname;
  };

  const currentPath = getCurrentPath();

  const {
    files,
    loading,
    error,
    hasStaticContent,
    loadFiles,
    setFiles,
    setError,
  } = useFileLoader(currentPath);

  const canUpload = user?.permissions?.includes("uploads") || false;
  const canDelete = user?.permissions?.includes("delete") || false;
  const isGuest = user?.permissions?.includes("restricted") || false;

  const {
    selectedFiles,
    handleSelectionChange,
    handleSelectAll,
    clearSelection,
    setSelectedFiles,
  } = useFileSelection(files);

  const { searchQuery, searchResults, handleSearch, clearSearch } =
    useFileSearch(currentPath, setError);

  const {
    showConfirm,
    confirmAction,
    confirmDelete,
    confirmMove,
    handleConfirm,
    handleCancel,
  } = useConfirmation();

  useFileManagerSSE(currentPath, loadFiles, setFiles, setChecksumProgress);

  const {
    deleteFile,
    renameFile,
    createFolder,
    deleteMultipleFiles,
    moveFilesToParent: moveFilesToParentOp,
    moveFilesToFolder: moveFilesToFolderOp,
  } = useFileOperations({
    onSuccess: () => {
      loadFiles();
      setSelectedFiles([]);
    },
    onError: (err) => setError(err),
    onConfirmDelete: confirmDelete,
    onConfirmMove: confirmMove,
  });

  useEffect(() => {
    console.log("FileManager useEffect - currentPath changed to:", currentPath);
    loadFiles();
    clearSearch();
    setSelectedFiles([]);
  }, [currentPath, loadFiles, clearSearch, setSelectedFiles]);

  const { handleDeleteSelected, handleMoveToParent, handleMoveToFolder } =
    useFileManagement(
      currentPath,
      deleteMultipleFiles,
      moveFilesToParentOp,
      moveFilesToFolderOp,
      setError
    );

  return (
    <FileManagerUI
      loading={loading}
      error={error}
      setError={setError}
      showUpload={showUpload}
      setShowUpload={setShowUpload}
      showCreateFolder={showCreateFolder}
      setShowCreateFolder={setShowCreateFolder}
      showConfirm={showConfirm}
      confirmAction={confirmAction}
      checksumProgress={checksumProgress}
      currentPath={currentPath}
      loadFiles={loadFiles}
      canUpload={canUpload}
      canDelete={canDelete}
      isGuest={isGuest}
      hasStaticContent={hasStaticContent}
      files={files}
      selectedFiles={selectedFiles}
      searchQuery={searchQuery}
      searchResults={searchResults}
      handleSearch={handleSearch}
      clearSearch={clearSearch}
      handleSelectionChange={handleSelectionChange}
      handleSelectAll={handleSelectAll}
      clearSelection={clearSelection}
      handleDeleteSelected={handleDeleteSelected}
      handleMoveToParent={handleMoveToParent}
      handleMoveToFolder={handleMoveToFolder}
      deleteFile={deleteFile}
      renameFile={renameFile}
      createFolder={createFolder}
      handleConfirm={handleConfirm}
      handleCancel={handleCancel}
      t={t}
    />
  );
};

export default FileManager;
