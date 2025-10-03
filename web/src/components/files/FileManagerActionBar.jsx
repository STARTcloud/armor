import PropTypes from "prop-types";

import SearchBar from "../search/SearchBar";

const FileManagerActionBar = ({
  canUpload,
  canDelete,
  selectedFiles,
  onCreateFolder,
  showUpload,
  onToggleUpload,
  onDeleteSelected,
  onClearSelection,
  onSearch,
  onClearSearch,
  searchQuery,
  t,
}) => (
  <div className="d-flex justify-content-between align-items-center mb-3">
    <div className="d-flex align-items-center gap-2">
      {canUpload ? (
        <>
          <button
            type="button"
            className="btn btn-success"
            onClick={onCreateFolder}
            title={t("files:folder.createFolderTooltip")}
          >
            <i className="bi bi-folder-plus" />
          </button>
          <button
            type="button"
            className={`btn ${showUpload ? "btn-primary" : "btn-outline-primary"}`}
            onClick={onToggleUpload}
            title={
              showUpload
                ? t("common:actions.hideUploadSection")
                : t("common:actions.showUploadSection")
            }
          >
            <i className="bi bi-cloud-upload" />
          </button>
        </>
      ) : null}
      {canDelete && selectedFiles.length > 0 ? (
        <>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onDeleteSelected}
            title={t("common:actions.deleteSelectedTooltip", {
              count: selectedFiles.length,
            })}
          >
            <i className="bi bi-trash" />
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClearSelection}
            title={t("common:actions.clearSelectionTooltip")}
          >
            <i className="bi bi-x-circle" /> {t("common:buttons.clear")}
          </button>
        </>
      ) : null}
    </div>
    <div className="d-flex align-items-center gap-2">
      <SearchBar
        onSearch={onSearch}
        onClear={onClearSearch}
        value={searchQuery}
      />
    </div>
  </div>
);

FileManagerActionBar.propTypes = {
  canUpload: PropTypes.bool.isRequired,
  canDelete: PropTypes.bool.isRequired,
  selectedFiles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onCreateFolder: PropTypes.func.isRequired,
  showUpload: PropTypes.bool.isRequired,
  onToggleUpload: PropTypes.func.isRequired,
  onDeleteSelected: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  onClearSearch: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
};

export default FileManagerActionBar;
