import { Link } from "react-router-dom";

const SearchResults = ({ results, query, onClear }) => {
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

  const getFileIcon = (file) => {
    if (file.isDirectory) {
      return "bi-folder-fill text-warning";
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

  const getFileLink = (file) => {
    if (file.isDirectory) {
      return `/browse${file.path}`;
    }
    return `/api/files${file.path}`;
  };

  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery || !text) {
      return text;
    }

    const regex = new RegExp(
      `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-warning text-dark">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleCopyChecksum = async (checksum) => {
    try {
      await navigator.clipboard.writeText(checksum);
    } catch (error) {
      console.error("Failed to copy checksum:", error);
    }
  };

  if (!results || !results.success) {
    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body text-center py-5">
          <i className="bi bi-exclamation-triangle display-4 text-warning mb-3" />
          <h5 className="text-light">Search Failed</h5>
          <p className="text-muted">
            Unable to perform search. Please try again.
          </p>
          <button className="btn btn-outline-primary" onClick={onClear}>
            <i className="bi bi-arrow-left me-2" />
            Back to Files
          </button>
        </div>
      </div>
    );
  }

  const { files = [], totalResults = 0 } = results;

  if (files.length === 0) {
    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body text-center py-5">
          <i className="bi bi-search display-4 text-muted mb-3" />
          <h5 className="text-light">No Results Found</h5>
          <p className="text-muted">
            No files or checksums found matching &quot;
            <strong>{query}</strong>&quot;
          </p>
          <button className="btn btn-outline-primary" onClick={onClear}>
            <i className="bi bi-arrow-left me-2" />
            Back to Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-dark border-secondary">
      <div className="card-header bg-dark border-secondary d-flex justify-content-between align-items-center">
        <h5 className="mb-0 text-light">
          <i className="bi bi-search me-2" />
          Search Results for &quot;{query}&quot; ({totalResults} found)
        </h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={onClear}>
          <i className="bi bi-x me-1" />
          Clear Search
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-dark table-hover mb-0">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Path</th>
              <th scope="col">Size</th>
              <th scope="col">Modified</th>
              <th scope="col">Checksum</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, index) => (
              <tr key={file.path || index}>
                <td>
                  <div className="d-flex align-items-center">
                    <i className={`bi ${getFileIcon(file)} me-2`} />
                    {file.isDirectory ? (
                      <Link
                        to={getFileLink(file)}
                        className="text-decoration-none text-light"
                      >
                        {highlightMatch(file.name, query)}
                      </Link>
                    ) : (
                      <a
                        href={getFileLink(file)}
                        className="text-decoration-none text-light"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {highlightMatch(file.name, query)}
                      </a>
                    )}
                  </div>
                </td>
                <td className="text-muted">
                  <small>{file.path}</small>
                </td>
                <td className="text-muted">
                  {file.isDirectory ? "-" : formatSize(file.size)}
                </td>
                <td className="text-muted">{formatDate(file.modified)}</td>
                <td>
                  {file.checksum ? (
                    <div className="d-flex align-items-center">
                      <code
                        className="text-success me-2"
                        style={{ fontSize: "0.8em" }}
                      >
                        {highlightMatch(
                          `${file.checksum.substring(0, 16)}...`,
                          query
                        )}
                      </code>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleCopyChecksum(file.checksum)}
                        title="Copy full checksum"
                      >
                        <i className="bi bi-clipboard" />
                      </button>
                    </div>
                  ) : file.isDirectory ? (
                    <span className="text-muted">-</span>
                  ) : (
                    <div
                      className="spinner-border spinner-border-sm text-warning"
                      role="status"
                    >
                      <span className="visually-hidden">Calculating...</span>
                    </div>
                  )}
                </td>
                <td>
                  <div className="btn-group btn-group-sm" role="group">
                    {!file.isDirectory && (
                      <a
                        href={getFileLink(file)}
                        className="btn btn-outline-info"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download file"
                      >
                        <i className="bi bi-download" />
                      </a>
                    )}
                    {file.isDirectory && (
                      <Link
                        to={getFileLink(file)}
                        className="btn btn-outline-primary"
                        title="Open folder"
                      >
                        <i className="bi bi-folder-open" />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SearchResults;
