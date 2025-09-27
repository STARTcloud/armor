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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const getCurrentPath = () => {
    const { pathname } = location;
    if (pathname.startsWith("/browse")) {
      return pathname.substring(7) || "/";
    }
    return "/";
  };

  const currentPath = getCurrentPath();

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(currentPath === '/' ? '' : currentPath);
      setFiles(response.data.files || []);
    } catch (err) {
      console.error("Failed to load files:", err);
      setError("Failed to load directory contents");
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useSSE({
    onFileAdded: (data) => {
      if (data.directory === currentPath) {
        loadFiles();
      }
    },
    onFileDeleted: (data) => {
      if (data.directory === currentPath) {
        loadFiles();
      }
    },
    onFileRenamed: (data) => {
      if (data.directory === currentPath) {
        loadFiles();
      }
    },
    onChecksumUpdate: (data) => {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.path === data.path ? { ...file, checksum: data.checksum } : file
        )
      );
    },
  });

  const handleConfirmDelete = (message) =>
    new Promise((resolve) => {
      setFileToDelete({ resolve, message });
      setShowDeleteConfirm(true);
    });

  const confirmDelete = () => {
    if (fileToDelete) {
      fileToDelete.resolve(true);
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  const cancelDelete = () => {
    if (fileToDelete) {
      fileToDelete.resolve(false);
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  const { deleteFile, renameFile, createFolder } = useFileOperations({
    onSuccess: () => loadFiles(),
    onError: (err) => setError(err),
    onConfirmDelete: handleConfirmDelete,
  });

  useEffect(() => {
    loadFiles();
    setSearchResults(null);
    setSearchQuery("");
  }, [currentPath, loadFiles]);

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchQuery("");
      return;
    }

    try {
      setSearchQuery(query);
      const searchEndpoint = currentPath === '/' ? '/search' : `${currentPath}/search`;
      const response = await api.post(searchEndpoint, {
        query: query,
        page: 1,
        limit: 100
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

      {/* Action Bar */}
      <div className="row mb-4">
        <div className="col-md-6">
          <SearchBar
            onSearch={handleSearch}
            onClear={clearSearch}
            value={searchQuery}
          />
        </div>
        <div className="col-md-6 text-end">
          <button
            className="btn btn-outline-success me-2"
            onClick={() => setShowUpload(!showUpload)}
            title={showUpload ? "Hide Upload Section" : "Show Upload Section"}
          >
            <i
              className={`bi ${showUpload ? "bi-cloud-upload-fill" : "bi-cloud-upload"}`}
            />
            {showUpload ? " Hide Upload" : " Upload Files"}
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowCreateFolder(true)}
          >
            <i className="bi bi-folder-plus" />
            New Folder
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <div className="row mb-4">
          <div className="col">
            <UploadZone
              currentPath={currentPath}
              onUploadComplete={() => loadFiles()}
            />
          </div>
        </div>
      )}

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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        title="Delete Item"
        message={
          fileToDelete?.message || "Are you sure you want to delete this item?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default FileManager;
