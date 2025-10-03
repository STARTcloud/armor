import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import FileRow from "./FileRow";

const FileTable = ({
  files,
  currentPath,
  onDelete,
  onRename,
  selectedFiles,
  onSelectionChange,
  onSelectAll,
  onMoveToParent,
  onMoveToFolder,
  canDelete = false,
  canUpload = false,
}) => {
  const { t } = useTranslation(["files", "common"]);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [dragOver, setDragOver] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "size") {
      aValue = a.isDirectory ? -1 : a.size || 0;
      bValue = b.isDirectory ? -1 : b.size || 0;
    } else if (sortField === "modified") {
      aValue = new Date(a.mtime || 0);
      bValue = new Date(b.mtime || 0);
    } else if (sortField === "name") {
      if (a.isDirectory && !b.isDirectory) {
        return -1;
      }
      if (!a.isDirectory && b.isDirectory) {
        return 1;
      }
      aValue = (a.name || "").toLowerCase();
      bValue = (b.name || "").toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return "bi-arrow-down-up";
    }
    return sortDirection === "asc" ? "bi-arrow-up" : "bi-arrow-down";
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) {
      return "-";
    }
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "-";
    }
    return new Date(dateString).toLocaleString();
  };

  const isEmpty = !files || files.length === 0;
  const allSelected = files.length > 0 && selectedFiles.length === files.length;
  const someSelected =
    selectedFiles.length > 0 && selectedFiles.length < files.length;

  const handleSelectAllChange = (e) => {
    onSelectAll(e.target.checked);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (selectedFiles.length > 0 && currentPath !== "/") {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (selectedFiles.length > 0 && currentPath !== "/") {
      onMoveToParent();
    }
  };

  // Only show multi-select if user has delete or upload permissions
  const showMultiSelect = canDelete || canUpload;

  const renderParentDirectoryRow = () => {
    if (currentPath === "/" || selectedFiles.length === 0 || !showMultiSelect) {
      return null;
    }

    return (
      <tr
        className={`parent-directory-row ${dragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          backgroundColor: dragOver ? "rgba(129, 25, 55, 0.2)" : "transparent",
          cursor: selectedFiles.length > 0 ? "pointer" : "default",
        }}
      >
        <td style={{ width: "5%" }} />
        <td>
          <i className="bi bi-folder-up me-2 text-warning" />
          <span className="text-muted">{t("files:table.parentDirectory")}</span>
        </td>
        <td className="text-muted">{t("files:table.folder")}</td>
        <td className="text-muted">-</td>
        <td className="text-muted">-</td>
        <td className="text-muted">-</td>
        <td />
      </tr>
    );
  };

  return (
    <div className="card bg-dark border-secondary">
      <div className="card-header bg-dark border-secondary">
        <h5 className="mb-0 text-light">
          <i className="bi bi-folder-fill me-2" />
          {t("files:table.directoryContents", { count: files?.length || 0 })}
        </h5>
      </div>
      <div className="table-responsive">
        <table className="table table-dark table-striped table-hover mb-0">
          <thead>
            <tr>
              <th scope="col" style={{ width: "5%" }}>
                {showMultiSelect ? (
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={handleSelectAllChange}
                    title={t("files:table.selectAllFiles")}
                  />
                ) : null}
              </th>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("name")}
              >
                {t("files:table.name")}{" "}
                <i className={`bi ${getSortIcon("name")} ms-1`} />
              </th>
              <th scope="col">{t("files:table.type")}</th>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("size")}
              >
                {t("files:table.size")}{" "}
                <i className={`bi ${getSortIcon("size")} ms-1`} />
              </th>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("modified")}
              >
                {t("files:table.modified")}{" "}
                <i className={`bi ${getSortIcon("modified")} ms-1`} />
              </th>
              <th scope="col">{t("files:table.checksum")}</th>
              <th scope="col" width="120">
                {t("files:table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {renderParentDirectoryRow()}
            {isEmpty ? (
              <tr>
                <td colSpan="7" className="text-center py-5">
                  <i className="bi bi-folder2-open display-4 text-muted mb-3 d-block" />
                  <h5 className="text-muted">
                    {t("files:messages.emptyDirectory")}
                  </h5>
                  <p className="text-muted">
                    {t("files:messages.uploadOrCreateToStart")}
                  </p>
                </td>
              </tr>
            ) : (
              sortedFiles.map((file, index) => (
                <FileRow
                  key={file.path || index}
                  file={file}
                  currentPath={currentPath}
                  onDelete={onDelete}
                  onRename={onRename}
                  formatSize={formatSize}
                  formatDate={formatDate}
                  isSelected={selectedFiles.includes(file.path)}
                  onSelectionChange={onSelectionChange}
                  selectedFiles={selectedFiles}
                  onMoveToFolder={onMoveToFolder}
                  dragOverFolder={dragOverFolder}
                  setDragOverFolder={setDragOverFolder}
                  canDelete={canDelete}
                  showMultiSelect={showMultiSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

FileTable.propTypes = {
  files: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentPath: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  selectedFiles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  onMoveToParent: PropTypes.func.isRequired,
  onMoveToFolder: PropTypes.func.isRequired,
  canDelete: PropTypes.bool,
  canUpload: PropTypes.bool,
};

export default FileTable;
