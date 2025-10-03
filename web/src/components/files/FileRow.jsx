import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getFileIcon, formatSize, formatDate } from "../../utils/fileHelpers";

const FileNameLink = ({ file, getFileLink }) => {
  if (file.isDirectory) {
    return (
      <Link to={getFileLink()} className="text-decoration-none text-light">
        {file.name}
      </Link>
    );
  }
  return (
    <a
      href={getFileLink()}
      className="text-decoration-none text-light"
      target="_blank"
      rel="noopener noreferrer"
    >
      {file.name}
    </a>
  );
};

FileNameLink.propTypes = {
  file: PropTypes.shape({
    name: PropTypes.string.isRequired,
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  getFileLink: PropTypes.func.isRequired,
};

const ChecksumDisplay = ({ file, onCopyChecksum, t }) => {
  if (file.isDirectory) {
    return <span className="text-muted">-</span>;
  }

  if (file.checksum) {
    return (
      <div className="d-flex align-items-center">
        <code className="text-success me-2" style={{ fontSize: "0.8em" }}>
          {file.checksum.substring(0, 16)}...
        </code>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={onCopyChecksum}
          title={t("files:file.copyFullChecksum")}
        >
          <i className="bi bi-clipboard" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="spinner-border spinner-border-sm text-warning"
      role="status"
    >
      <span className="visually-hidden">{t("files:file.calculating")}</span>
    </div>
  );
};

ChecksumDisplay.propTypes = {
  file: PropTypes.shape({
    checksum: PropTypes.string,
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  onCopyChecksum: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

const FileIcon = ({ file, onIconClick, t }) => {
  const [pressTimer, setPressTimer] = useState(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const handleDownload = () => {
    if (!file.isDirectory) {
      const downloadUrl = `${window.location.origin}${file.path}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.name;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleMouseDown = () => {
    if (file.isDirectory) {
      return;
    }

    setIsLongPress(false);
    const timer = setTimeout(() => {
      setIsLongPress(true);
      handleDownload();
    }, 500);
    setPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setTimeout(() => setIsLongPress(false), 100);
  };

  const handleClick = async (e) => {
    if (!isLongPress) {
      e.preventDefault();
      await onIconClick();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <i
      className={`bi ${getFileIcon(file)} me-2`}
      style={{ cursor: "pointer" }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={
        file.isDirectory
          ? t("files:file.clickToCopyLink")
          : t("files:file.clickToCopyLinkHoldToDownload")
      }
      title={
        file.isDirectory
          ? t("files:file.clickToCopyLink")
          : t("files:file.clickToCopyLinkHoldToDownload")
      }
    />
  );
};

FileIcon.propTypes = {
  file: PropTypes.shape({
    path: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  onIconClick: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

const RenameInput = ({ value, onChange, onSubmit, onCancel }) => (
  <form onSubmit={onSubmit} className="d-flex align-items-center">
    <input
      type="text"
      className="form-control form-control-sm bg-dark text-light border-secondary"
      value={value}
      onChange={onChange}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onCancel();
        } else if (e.key === "Enter") {
          onSubmit(e);
        }
      }}
      style={{ maxWidth: "200px" }}
    />
  </form>
);

RenameInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

const ActionButtons = ({
  canDelete,
  onCopyLink,
  onRename,
  onDelete,
  file,
  t,
}) => (
  <div className="btn-group btn-group-sm" role="group">
    <button
      className="btn btn-outline-info"
      onClick={onCopyLink}
      title={
        file.isDirectory
          ? t("files:file.copyFolderLink")
          : t("files:file.copyDownloadLink")
      }
    >
      <i className="bi bi-link-45deg" />
    </button>
    {canDelete ? (
      <>
        <button
          className="btn btn-outline-warning"
          onClick={onRename}
          title={t("files:file.rename")}
        >
          <i className="bi bi-pencil" />
        </button>
        <button
          className="btn btn-outline-danger"
          onClick={onDelete}
          title={t("files:file.delete")}
        >
          <i className="bi bi-trash" />
        </button>
      </>
    ) : null}
  </div>
);

ActionButtons.propTypes = {
  canDelete: PropTypes.bool.isRequired,
  onCopyLink: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  file: PropTypes.shape({
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  t: PropTypes.func.isRequired,
};

const useFileRowHandlers = (file, onRename, setIsRenaming, setNewName) => {
  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${file.path}`;
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleCopyChecksum = async () => {
    if (!file.checksum) {
      return;
    }

    try {
      await navigator.clipboard.writeText(file.checksum);
    } catch (error) {
      console.error("Failed to copy checksum:", error);
    }
  };

  const handleRenameSubmit = async (e, newName) => {
    e.preventDefault();
    if (!newName.trim() || newName === file.name) {
      setIsRenaming(false);
      return;
    }

    try {
      await onRename(file.path, newName.trim());
      setIsRenaming(false);
    } catch (error) {
      console.error("Failed to rename file:", error);
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName(file.name || "");
  };

  return {
    handleCopyLink,
    handleCopyChecksum,
    handleRenameSubmit,
    handleRenameCancel,
  };
};

const useDragAndDrop = (
  file,
  selectedFiles,
  dragOverFolder,
  setDragOverFolder,
  onMoveToFolder,
  isSelected
) => {
  const handleDragStart = (e) => {
    if (!isSelected) {
      return;
    }

    e.dataTransfer.setData("text/plain", file.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const canDrop =
      file.isDirectory &&
      selectedFiles.length > 0 &&
      !selectedFiles.includes(file.path);

    if (canDrop) {
      setDragOverFolder(file.path);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleFolderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    const isOutside =
      x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

    if (isOutside && dragOverFolder === file.path) {
      setDragOverFolder(null);
    }
  };

  const handleFolderDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const canDrop =
      file.isDirectory &&
      selectedFiles.length > 0 &&
      !selectedFiles.includes(file.path);

    if (canDrop) {
      onMoveToFolder(file.path, file.name);
    }

    setDragOverFolder(null);
  };

  const isDraggedOver = dragOverFolder === file.path;
  const canAcceptDrop =
    file.isDirectory &&
    selectedFiles.length > 0 &&
    !selectedFiles.includes(file.path);

  return {
    handleDragStart,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    isDraggedOver,
    canAcceptDrop,
  };
};

const FileRow = ({
  file,
  currentPath,
  onDelete,
  onRename,
  isSelected,
  onSelectionChange,
  selectedFiles,
  onMoveToFolder,
  dragOverFolder,
  setDragOverFolder,
  canDelete = false,
  showMultiSelect = false,
}) => {
  const { t } = useTranslation(["files", "common"]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name || "");

  const {
    handleCopyLink,
    handleCopyChecksum,
    handleRenameSubmit,
    handleRenameCancel,
  } = useFileRowHandlers(file, onRename, setIsRenaming, setNewName);

  const {
    handleDragStart,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    isDraggedOver,
    canAcceptDrop,
  } = useDragAndDrop(
    file,
    selectedFiles,
    dragOverFolder,
    setDragOverFolder,
    onMoveToFolder,
    isSelected
  );

  const getFileLink = () => {
    if (file.isDirectory) {
      return currentPath === "/"
        ? `/${file.name}`
        : `${currentPath}/${file.name}`;
    }
    return file.path;
  };

  const handleSelectionChange = (e) => {
    onSelectionChange(file.path, e.target.checked);
  };

  const rowClassName = `${isSelected ? "table-active" : ""} ${isDraggedOver ? "drag-over-folder" : ""}`;
  const dragEnabled = showMultiSelect && isSelected;
  const dropEnabled = showMultiSelect && canAcceptDrop;

  return (
    <tr
      className={rowClassName}
      draggable={dragEnabled}
      onDragStart={dragEnabled ? handleDragStart : undefined}
      onDragOver={dropEnabled ? handleFolderDragOver : undefined}
      onDragLeave={dropEnabled ? handleFolderDragLeave : undefined}
      onDrop={dropEnabled ? handleFolderDrop : undefined}
      style={{
        backgroundColor: isDraggedOver ? "rgba(25, 135, 84, 0.2)" : undefined,
        cursor: dropEnabled ? "copy" : undefined,
      }}
    >
      <td style={{ width: "5%", padding: "8px" }}>
        {showMultiSelect ? (
          <input
            type="checkbox"
            className="form-check-input"
            checked={isSelected}
            onChange={handleSelectionChange}
            title={t("files:file.selectFile")}
          />
        ) : null}
      </td>
      <td>
        <div className="d-flex align-items-center">
          <FileIcon file={file} onIconClick={handleCopyLink} t={t} />
          {isRenaming ? (
            <RenameInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onSubmit={(e) => handleRenameSubmit(e, newName)}
              onCancel={handleRenameCancel}
            />
          ) : (
            <FileNameLink file={file} getFileLink={getFileLink} />
          )}
        </div>
      </td>
      <td className="text-light">
        {file.isDirectory ? t("files:file.folder") : t("files:file.file")}
      </td>
      <td className="text-light">
        {file.isDirectory ? "-" : formatSize(file.size)}
      </td>
      <td className="text-light">{formatDate(file.mtime)}</td>
      <td>
        <ChecksumDisplay
          file={file}
          onCopyChecksum={handleCopyChecksum}
          t={t}
        />
      </td>
      <td>
        <ActionButtons
          canDelete={canDelete}
          onCopyLink={handleCopyLink}
          onRename={() => {
            setNewName(file.name || "");
            setIsRenaming(true);
          }}
          onDelete={() => onDelete(file.path)}
          file={file}
          t={t}
        />
      </td>
    </tr>
  );
};

FileRow.propTypes = {
  file: PropTypes.shape({
    name: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    isDirectory: PropTypes.bool.isRequired,
    size: PropTypes.number,
    mtime: PropTypes.string,
    checksum: PropTypes.string,
  }).isRequired,
  currentPath: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  selectedFiles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onMoveToFolder: PropTypes.func.isRequired,
  dragOverFolder: PropTypes.string,
  setDragOverFolder: PropTypes.func.isRequired,
  canDelete: PropTypes.bool,
  showMultiSelect: PropTypes.bool,
};

export default FileRow;
