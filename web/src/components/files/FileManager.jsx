import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import useFileOperations from "../../hooks/useFileOperations";
import useSSE from "../../hooks/useSSE";
import api from "../../utils/api";
import ConfirmModal from "../common/ConfirmModal";
import SearchBar from "../search/SearchBar";
import SearchResults from "../search/SearchResults";

import ChecksumProgress from "./ChecksumProgress";
import CreateFolderModal from "./CreateFolderModal";
import FileTable from "./FileTable";
import UploadZone from "./UploadZone";

const FileManager = () => {
  const location = useLocation();
  const { t } = useTranslation(["files", "common"]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [checksumProgress, setChecksumProgress] = useState(null);

  const getCurrentPath = () => {
    const { pathname } = location;
    return pathname === "/" ? "/" : pathname;
  };

  const currentPath = getCurrentPath();

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Loading files for currentPath:", currentPath);
      const apiPath =
        currentPath === "/" ? "/api/files/" : `/api/files${currentPath}`;
      console.log("Making API call to:", apiPath);

      const response = await api.get(apiPath);
      console.log("API response:", response);
      setFiles(response.data.files || []);
    } catch (err) {
      console.error("Failed to load files:", err);
      console.error("Error details:", err.response?.data, err.response?.status);
      setError(t("files:messages.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [currentPath, t]);

  const handleFileAdded = useCallback(() => {
    console.log(
      "SSE onFileAdded - ignoring during scanning to prevent page reloads"
    );
  }, []);

  const handleFileDeleted = useCallback(
    (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      const fileDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (fileDirectory === currentPath || webPath.startsWith(currentPath)) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleFileRenamed = useCallback(
    (data) => {
      const oldWebPath = data.oldPath.replace("/local/www", "") || "/";
      const newWebPath = data.newPath.replace("/local/www", "") || "/";
      const oldDirectory =
        oldWebPath.substring(0, oldWebPath.lastIndexOf("/")) || "/";
      const newDirectory =
        newWebPath.substring(0, newWebPath.lastIndexOf("/")) || "/";
      if (oldDirectory === currentPath || newDirectory === currentPath) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleFolderCreated = useCallback(
    (data) => {
      const webPath = data.folderPath.replace("/local/www", "") || "/";
      const folderDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (folderDirectory === currentPath) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleChecksumUpdate = useCallback((data) => {
    const webPath = data.filePath.replace("/local/www", "") || "/";
    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.path === webPath ? { ...file, checksum: data.checksum } : file
      )
    );
  }, []);

  const handleChecksumProgress = useCallback((data) => {
    setChecksumProgress(data);
  }, []);

  useSSE({
    onFileAdded: handleFileAdded,
    onFileDeleted: handleFileDeleted,
    onFileRenamed: handleFileRenamed,
    onFolderCreated: handleFolderCreated,
    onChecksumUpdate: handleChecksumUpdate,
    onChecksumProgress: handleChecksumProgress,
  });

  const handleConfirmDelete = (message) =>
    new Promise((resolve) => {
      setConfirmAction({
        resolve,
        message,
        title: t("files:operations.delete"),
        confirmText: t("common:buttons.delete"),
        variant: "danger",
      });
      setShowConfirm(true);
    });

  const handleConfirmMove = (message) =>
    new Promise((resolve) => {
      setConfirmAction({
        resolve,
        message,
        title: t("files:operations.move"),
        confirmText: t("common:buttons.move"),
        variant: "primary",
      });
      setShowConfirm(true);
    });

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction.resolve(true);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  };

  const handleCancel = () => {
    if (confirmAction) {
      confirmAction.resolve(false);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  };

  const {
    deleteFile,
    renameFile,
    createFolder,
    deleteMultipleFiles,
    moveFilesToParent,
    moveFilesToFolder,
  } = useFileOperations({
    onSuccess: () => {
      loadFiles();
      setSelectedFiles([]);
    },
    onError: (err) => setError(err),
    onConfirmDelete: handleConfirmDelete,
    onConfirmMove: handleConfirmMove,
  });

  useEffect(() => {
    console.log("FileManager useEffect - currentPath changed to:", currentPath); // (important-comment)
    loadFiles();
    setSearchResults(null);
    setSearchQuery("");
    setSelectedFiles([]);
  }, [currentPath, loadFiles]);

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchQuery("");
      return;
    }

    try {
      setSearchQuery(query);
      const searchEndpoint =
        currentPath === "/"
          ? "/api/files/search"
          : `/api/files${currentPath}/search`;
      const response = await api.post(searchEndpoint, {
        query,
        page: 1,
        limit: 100,
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error("Search failed:", err);
      setError(t("files:search.searchError"));
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  const handleCreateFolder = async (folderName) => {
    try {
      await createFolder(currentPath, folderName);
      setShowCreateFolder(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectionChange = (filePath, isSelected) => {
    setSelectedFiles((prev) => {
      if (isSelected) {
        return [...prev, filePath];
      }
      return prev.filter((path) => path !== filePath);
    });
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedFiles(files.map((file) => file.path));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    try {
      await deleteMultipleFiles(selectedFiles);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const handleMoveToParent = async () => {
    if (selectedFiles.length === 0 || currentPath === "/") {
      return;
    }

    try {
      await moveFilesToParent(selectedFiles, currentPath);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMoveToFolder = async (destinationPath, destinationName) => {
    if (selectedFiles.length === 0) {
      return;
    }

    try {
      await moveFilesToFolder(selectedFiles, destinationPath, destinationName);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">
              {t("files:messages.loadingFiles")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {Boolean(error) && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError("")}
            aria-label="Close"
          />
        </div>
      )}

      {/* Upload Zone */}
      {Boolean(showUpload) && (
        <UploadZone
          currentPath={currentPath}
          onUploadComplete={() => loadFiles()}
        />
      )}

      {/* Action Bar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setShowCreateFolder(true)}
            title={t("files:folder.createFolderTooltip")}
          >
            <i className="bi bi-folder-plus" />
          </button>
          <button
            type="button"
            className={`btn ${showUpload ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setShowUpload(!showUpload)}
            title={
              showUpload
                ? t("common:actions.hideUploadSection")
                : t("common:actions.showUploadSection")
            }
          >
            <i className="bi bi-cloud-upload" />
          </button>
          {selectedFiles.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDeleteSelected}
                title={t("common:actions.deleteSelectedTooltip", {
                  count: selectedFiles.length,
                })}
              >
                <i className="bi bi-trash" />
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={clearSelection}
                title={t("common:actions.clearSelectionTooltip")}
              >
                <i className="bi bi-x-circle" /> {t("common:buttons.clear")}
              </button>
            </>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          <SearchBar
            onSearch={handleSearch}
            onClear={clearSearch}
            value={searchQuery}
          />
        </div>
      </div>

      {/* Search Results or File Table */}
      <div className="row">
        <div className="col">
          {searchResults ? (
            <SearchResults
              results={searchResults}
              query={searchQuery}
              onClear={clearSearch}
            />
          ) : (
            <FileTable
              files={files}
              currentPath={currentPath}
              onDelete={deleteFile}
              onRename={renameFile}
              selectedFiles={selectedFiles}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
              onMoveToParent={handleMoveToParent}
              onMoveToFolder={handleMoveToFolder}
            />
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      <CreateFolderModal
        show={showCreateFolder}
        onHide={() => setShowCreateFolder(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        show={showConfirm}
        title={
          confirmAction?.title || t("common:messages.confirmActionFallback")
        }
        message={
          confirmAction?.message || t("common:messages.areYouSureFallback")
        }
        confirmText={
          confirmAction?.confirmText || t("common:messages.confirmFallback")
        }
        cancelText={t("common:buttons.cancel")}
        variant={confirmAction?.variant || "primary"}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Checksum Progress */}
      <ChecksumProgress progressData={checksumProgress} />
    </div>
  );
};

export default FileManager;
