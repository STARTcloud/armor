import PropTypes from "prop-types";

import ConfirmModal from "../common/ConfirmModal";

import ChecksumProgress from "./ChecksumProgress";
import CreateFolderModal from "./CreateFolderModal";
import FileManagerActionBar from "./FileManagerActionBar";
import FileManagerContent from "./FileManagerContent";
import UploadZone from "./UploadZone";

const FileManagerUI = ({
  loading,
  error,
  setError,
  showUpload,
  setShowUpload,
  showCreateFolder,
  setShowCreateFolder,
  showConfirm,
  confirmAction,
  checksumProgress,
  currentPath,
  loadFiles,
  canUpload,
  canDelete,
  isGuest,
  hasStaticContent,
  files,
  selectedFiles,
  searchQuery,
  searchResults,
  handleSearch,
  clearSearch,
  handleSelectionChange,
  handleSelectAll,
  clearSelection,
  handleDeleteSelected,
  handleMoveToParent,
  handleMoveToFolder,
  deleteFile,
  renameFile,
  createFolder,
  handleConfirm,
  handleCancel,
  t,
}) => {
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
      {error ? (
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
      ) : null}

      {showUpload ? (
        <UploadZone
          currentPath={currentPath}
          onUploadComplete={() => loadFiles()}
        />
      ) : null}

      {!hasStaticContent ? (
        <FileManagerActionBar
          canUpload={canUpload}
          canDelete={canDelete}
          selectedFiles={selectedFiles}
          onCreateFolder={() => setShowCreateFolder(true)}
          showUpload={showUpload}
          onToggleUpload={() => setShowUpload(!showUpload)}
          onDeleteSelected={() => handleDeleteSelected(selectedFiles)}
          onClearSelection={clearSelection}
          onSearch={handleSearch}
          onClearSearch={clearSearch}
          searchQuery={searchQuery}
          t={t}
        />
      ) : null}

      <div className="row">
        <div className="col">
          <FileManagerContent
            searchResults={searchResults}
            searchQuery={searchQuery}
            onClearSearch={clearSearch}
            hasStaticContent={hasStaticContent}
            isGuest={isGuest}
            currentPath={currentPath}
            files={files}
            onDelete={deleteFile}
            onRename={renameFile}
            selectedFiles={selectedFiles}
            onSelectionChange={handleSelectionChange}
            onSelectAll={handleSelectAll}
            onMoveToParent={() => handleMoveToParent(selectedFiles)}
            onMoveToFolder={(destPath, destName) =>
              handleMoveToFolder(selectedFiles, destPath, destName)
            }
            canDelete={canDelete}
            canUpload={canUpload}
          />
        </div>
      </div>

      <CreateFolderModal
        show={showCreateFolder}
        onHide={() => setShowCreateFolder(false)}
        onCreateFolder={async (folderName) => {
          try {
            await createFolder(currentPath, folderName);
            setShowCreateFolder(false);
          } catch (err) {
            setError(err.message);
          }
        }}
      />

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

      <ChecksumProgress progressData={checksumProgress} />
    </div>
  );
};

FileManagerUI.propTypes = {
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  setError: PropTypes.func.isRequired,
  showUpload: PropTypes.bool.isRequired,
  setShowUpload: PropTypes.func.isRequired,
  showCreateFolder: PropTypes.bool.isRequired,
  setShowCreateFolder: PropTypes.func.isRequired,
  showConfirm: PropTypes.bool.isRequired,
  confirmAction: PropTypes.object,
  checksumProgress: PropTypes.object,
  currentPath: PropTypes.string.isRequired,
  loadFiles: PropTypes.func.isRequired,
  canUpload: PropTypes.bool.isRequired,
  canDelete: PropTypes.bool.isRequired,
  isGuest: PropTypes.bool.isRequired,
  hasStaticContent: PropTypes.bool.isRequired,
  files: PropTypes.array.isRequired,
  selectedFiles: PropTypes.array.isRequired,
  searchQuery: PropTypes.string.isRequired,
  searchResults: PropTypes.object,
  handleSearch: PropTypes.func.isRequired,
  clearSearch: PropTypes.func.isRequired,
  handleSelectionChange: PropTypes.func.isRequired,
  handleSelectAll: PropTypes.func.isRequired,
  clearSelection: PropTypes.func.isRequired,
  handleDeleteSelected: PropTypes.func.isRequired,
  handleMoveToParent: PropTypes.func.isRequired,
  handleMoveToFolder: PropTypes.func.isRequired,
  deleteFile: PropTypes.func.isRequired,
  renameFile: PropTypes.func.isRequired,
  createFolder: PropTypes.func.isRequired,
  handleConfirm: PropTypes.func.isRequired,
  handleCancel: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default FileManagerUI;
