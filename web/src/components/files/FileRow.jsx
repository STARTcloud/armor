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
}) => {
  const { t } = useTranslation(["files", "common"]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name || "");
  const [pressTimer, setPressTimer] = useState(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const handleSelectionChange = (e) => {
    onSelectionChange(file.path, e.target.checked);
  };

  const handleRename = async (e) => {
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

  const handleCopyChecksum = async () => {
    if (file.checksum) {
      try {
        await navigator.clipboard.writeText(file.checksum);
      } catch (error) {
        console.error("Failed to copy checksum:", error);
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${file.path}`;
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleDownloadFile = () => {
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

  const handleIconMouseDown = () => {
    if (!file.isDirectory) {
      setIsLongPress(false);
      const timer = setTimeout(() => {
        setIsLongPress(true);
        handleDownloadFile();
      }, 500);
      setPressTimer(timer);
    }
  };

  const handleIconMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setTimeout(() => setIsLongPress(false), 100);
  };

  const handleIconClick = async (e) => {
    if (!isLongPress) {
      e.preventDefault();
      await handleCopyLink();
    }
  };

  const getFileLink = () => {
    if (file.isDirectory) {
      const newPath =
        currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
      return newPath;
    }
    return file.path;
  };

  const handleDragStart = (e) => {
    if (isSelected) {
      e.dataTransfer.setData("text/plain", file.path);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  // Folder drag and drop handlers
  const handleFolderDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Only allow dropping on folders that aren't selected
    if (
      file.isDirectory &&
      selectedFiles.length > 0 &&
      !selectedFiles.includes(file.path)
    ) {
      setDragOverFolder(file.path);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleFolderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear if we're actually leaving this folder row
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      if (dragOverFolder === file.path) {
        setDragOverFolder(null);
      }
    }
  };

  const handleFolderDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      file.isDirectory &&
      selectedFiles.length > 0 &&
      !selectedFiles.includes(file.path)
    ) {
      onMoveToFolder(file.path, file.name);
    }

    setDragOverFolder(null);
  };

  const isDraggedOver = dragOverFolder === file.path;
  const canAcceptDrop =
    file.isDirectory &&
    selectedFiles.length > 0 &&
    !selectedFiles.includes(file.path);

  return (
    <tr
      className={`${isSelected ? "table-active" : ""} ${isDraggedOver ? "drag-over-folder" : ""}`}
      draggable={isSelected}
      onDragStart={handleDragStart}
      onDragOver={canAcceptDrop ? handleFolderDragOver : undefined}
      onDragLeave={canAcceptDrop ? handleFolderDragLeave : undefined}
      onDrop={canAcceptDrop ? handleFolderDrop : undefined}
      style={{
        backgroundColor: isDraggedOver ? "rgba(25, 135, 84, 0.2)" : undefined,
        cursor: canAcceptDrop && selectedFiles.length > 0 ? "copy" : undefined,
      }}
    >
      <td style={{ width: "5%", padding: "8px" }}>
        <input
          type="checkbox"
          className="form-check-input"
          checked={isSelected}
          onChange={handleSelectionChange}
          title={t("files:file.selectFile")}
        />
      </td>
      <td>
        <div className="d-flex align-items-center">
          <i
            className={`bi ${getFileIcon(file)} me-2`}
            style={{ cursor: "pointer" }}
            onMouseDown={handleIconMouseDown}
            onMouseUp={handleIconMouseUp}
            onMouseLeave={handleIconMouseUp}
            onClick={handleIconClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleIconClick(e);
              }
            }}
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
          {isRenaming ? (
            <form onSubmit={handleRename} className="d-flex align-items-center">
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-light border-secondary"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setNewName(file.name || "");
                  } else if (e.key === "Enter") {
                    handleRename(e);
                  }
                }}
                style={{ maxWidth: "200px" }}
              />
            </form>
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
        <div className="btn-group btn-group-sm" role="group">
          <button
            className="btn btn-outline-info"
            onClick={handleCopyLink}
            title={
              file.isDirectory
                ? t("files:file.copyFolderLink")
                : t("files:file.copyDownloadLink")
            }
          >
            <i className="bi bi-link-45deg" />
          </button>
          <button
            className="btn btn-outline-warning"
            onClick={() => {
              setNewName(file.name || "");
              setIsRenaming(true);
            }}
            title={t("files:file.rename")}
          >
            <i className="bi bi-pencil" />
          </button>
          <button
            className="btn btn-outline-danger"
            onClick={() => onDelete(file.path)}
            title={t("files:file.delete")}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
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
};

export default FileRow;
