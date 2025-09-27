import PropTypes from "prop-types";
import { useState } from "react";
import { Link } from "react-router-dom";

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

const ChecksumDisplay = ({ file, onCopyChecksum }) => {
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
          title="Copy full checksum"
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
      <span className="visually-hidden">Calculating...</span>
    </div>
  );
};

ChecksumDisplay.propTypes = {
  file: PropTypes.shape({
    checksum: PropTypes.string,
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  onCopyChecksum: PropTypes.func.isRequired,
};

const FileRow = ({
  file,
  currentPath,
  onDelete,
  onRename,
  formatSize,
  formatDate,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name || "");

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

  const getFileIcon = () => {
    if (file.isDirectory) {
      return "bi-folder text-light";
    }

    const ext = file.name?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "bi-file-earmark-pdf text-danger";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
        return "bi-file-earmark-image text-info";
      case "mp4":
      case "avi":
      case "mov":
        return "bi-file-earmark-play text-primary";
      case "mp3":
      case "wav":
      case "flac":
        return "bi-file-earmark-music text-success";
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return "bi-file-earmark-zip text-secondary";
      case "txt":
      case "md":
        return "bi-file-earmark-text text-light";
      case "js":
      case "jsx":
      case "ts":
      case "tsx":
      case "html":
      case "css":
      case "json":
        return "bi-file-earmark-code text-info";
      default:
        return "bi-file-earmark text-light";
    }
  };

  const getFileLink = () => {
    if (file.isDirectory) {
      const newPath =
        currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
      return `/browse${newPath}`;
    }
    return file.path;
  };

  return (
    <tr>
      <td>
        <div className="d-flex align-items-center">
          <i className={`bi ${getFileIcon()} me-2`} />
          {isRenaming ? (
            <form onSubmit={handleRename} className="d-flex align-items-center">
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-light border-secondary"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setIsRenaming(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setNewName(file.name || "");
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
      <td className="text-muted">{file.isDirectory ? "Folder" : "File"}</td>
      <td className="text-muted">
        {file.isDirectory ? "-" : formatSize(file.size)}
      </td>
      <td className="text-muted">{formatDate(file.modified)}</td>
      <td>
        <ChecksumDisplay file={file} onCopyChecksum={handleCopyChecksum} />
      </td>
      <td>
        <div className="btn-group btn-group-sm" role="group">
          {!file.isDirectory && (
            <button
              className="btn btn-outline-info"
              onClick={handleCopyLink}
              title="Copy download link"
            >
              <i className="bi bi-link-45deg" />
            </button>
          )}
          <button
            className="btn btn-outline-warning"
            onClick={() => {
              setNewName(file.name || "");
              setIsRenaming(true);
            }}
            title="Rename"
          >
            <i className="bi bi-pencil" />
          </button>
          <button
            className="btn btn-outline-danger"
            onClick={() => onDelete(file.path)}
            title="Delete"
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
    modified: PropTypes.string,
    checksum: PropTypes.string,
  }).isRequired,
  currentPath: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  formatSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
};

export default FileRow;
