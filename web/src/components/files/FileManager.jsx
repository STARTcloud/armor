import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

import useFileOperations from "../../hooks/useFileOperations";
import useSSE from "../../hooks/useSSE";
import api from "../../utils/api";
import ConfirmModal from "../common/ConfirmModal";
import SearchBar from "../search/SearchBar";
import SearchResults from "../search/SearchResults";

import CreateFolderModal from "./CreateFolderModal";
import FileTable from "./FileTable";
import UploadZone from "./UploadZone";

const FileManager = () => {
  const location = useLocation();
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
      setError("Failed to load directory contents");
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useSSE({
    onFileAdded: (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      const fileDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      console.log(
        "SSE onFileAdded - currentPath:",
        currentPath,
        "fileDirectory:",
        fileDirectory,
        "webPath:",
        webPath
      ); // (important-comment)
      if (fileDirectory === currentPath || webPath.startsWith(currentPath)) {
        console.log("SSE onFileAdded - MATCH! Calling loadFiles()"); // (important-comment)
        loadFiles();
      } else {
        console.log("SSE onFileAdded - NO MATCH, ignoring event"); // (important-comment)
      }
    },
    onFileDeleted: (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      const fileDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (fileDirectory === currentPath || webPath.startsWith(currentPath)) {
        loadFiles();
      }
    },
    onFileRenamed: (data) => {
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
    onFolderCreated: (data) => {
      const webPath = data.folderPath.replace("/local/www", "") || "/";
      const folderDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (folderDirectory === currentPath) {
        loadFiles();
      }
    },
    onChecksumUpdate: (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.path === webPath ? { ...file, checksum: data.checksum } : file
        )
      );
    },
  });

  const handleConfirmDelete = (message) =>
    new Promise((resolve) => {
      setConfirmAction({
        resolve,
        message,
        title: "Delete Item",
        confirmText: "Delete",
        variant: "danger",
      });
      setShowConfirm(true);
    });

  const handleConfirmMove = (message) =>
    new Promise((resolve) => {
      setConfirmAction({
        resolve,
        message,
        title: "Move Items",
        confirmText: "Move",
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
      setError("Search failed");
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

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {error && (
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
      {showUpload && (
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
            title="Create Folder"
          >
            <i className="bi bi-folder-plus" />
          </button>
          <button
            type="button"
            className={`btn ${showUpload ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setShowUpload(!showUpload)}
            title={showUpload ? "Hide Upload Section" : "Show Upload Section"}
          >
            <i className="bi bi-cloud-upload" />
          </button>
          {selectedFiles.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDeleteSelected}
                title={`Delete ${selectedFiles.length} selected files`}
              >
                <i className="bi bi-trash" />
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={clearSelection}
                title="Clear selection"
              >
                <i className="bi bi-x-circle" /> Clear
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
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || "Are you sure?"}
        confirmText={confirmAction?.confirmText || "Confirm"}
        cancelText="Cancel"
        variant={confirmAction?.variant || "primary"}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default FileManager;
