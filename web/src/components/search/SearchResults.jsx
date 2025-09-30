import PropTypes from "prop-types";
import { Link } from "react-router-dom";

import {
  formatSize,
  formatDate,
  getFileIcon,
  highlightMatch,
} from "../../utils/fileHelpers";

const getFileLink = (file) => {
  if (file.isDirectory) {
    return `/browse${file.path}`;
  }
  return `/api/files${file.path}`;
};

const SearchChecksumDisplay = ({ file, query, onCopyChecksum }) => {
  if (file.checksum) {
    const highlighted = highlightMatch(
      `${file.checksum.substring(0, 16)}...`,
      query
    );
    return (
      <div className="d-flex align-items-center">
        <code className="text-success me-2" style={{ fontSize: "0.8em" }}>
          {highlighted.map((part) =>
            part.isHighlight ? (
              <mark key={part.key} className="bg-warning text-dark">
                {part.text}
              </mark>
            ) : (
              <span key={part.key}>{part.text}</span>
            )
          )}
        </code>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onCopyChecksum(file.checksum)}
          title="Copy full checksum"
        >
          <i className="bi bi-clipboard" />
        </button>
      </div>
    );
  }

  if (file.isDirectory) {
    return <span className="text-muted">-</span>;
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

SearchChecksumDisplay.propTypes = {
  file: PropTypes.shape({
    checksum: PropTypes.string,
    isDirectory: PropTypes.bool.isRequired,
  }).isRequired,
  query: PropTypes.string.isRequired,
  onCopyChecksum: PropTypes.func.isRequired,
};

const SearchResults = ({ results, query, onClear }) => {
  const handleCopyChecksum = async (checksum) => {
    try {
      await navigator.clipboard.writeText(checksum);
    } catch (error) {
      console.error("Failed to copy checksum:", error);
    }
  };

  if (!results || !results.success) {
    return (
      <div className="card bg-dark border-0">
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

  const { results: files = [], pagination = {} } = results;
  const totalResults = pagination.total || 0;

  if (files.length === 0) {
    return (
      <div className="card bg-dark border-0">
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
    <div className="card bg-dark border-0">
      <div className="card-header bg-dark border-0">
        <h5 className="mb-0 text-light">
          <i className="bi bi-search me-2" />
          Search Results for &quot;{query}&quot; ({totalResults} found)
        </h5>
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
            {files.map((file) => (
              <tr key={file.path}>
                <td>
                  <div className="d-flex align-items-center">
                    <i className={`bi ${getFileIcon(file)} me-2`} />
                    {file.isDirectory ? (
                      <Link
                        to={getFileLink(file)}
                        className="text-decoration-none text-light"
                      >
                        {highlightMatch(file.name, query).map((part) =>
                          part.isHighlight ? (
                            <mark
                              key={part.key}
                              className="bg-warning text-dark"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={part.key}>{part.text}</span>
                          )
                        )}
                      </Link>
                    ) : (
                      <a
                        href={getFileLink(file)}
                        className="text-decoration-none text-light"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {highlightMatch(file.name, query).map((part) =>
                          part.isHighlight ? (
                            <mark
                              key={part.key}
                              className="bg-warning text-dark"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={part.key}>{part.text}</span>
                          )
                        )}
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
                <td className="text-muted">{formatDate(file.mtime, "-")}</td>
                <td>
                  <SearchChecksumDisplay
                    file={file}
                    query={query}
                    onCopyChecksum={handleCopyChecksum}
                  />
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
                    {Boolean(file.isDirectory) && (
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

SearchResults.propTypes = {
  results: PropTypes.shape({
    success: PropTypes.bool.isRequired,
    results: PropTypes.arrayOf(PropTypes.object),
    pagination: PropTypes.shape({
      total: PropTypes.number,
    }),
    files: PropTypes.arrayOf(PropTypes.object),
    totalResults: PropTypes.number,
  }),
  query: PropTypes.string.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default SearchResults;
