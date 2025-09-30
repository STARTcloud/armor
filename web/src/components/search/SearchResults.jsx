import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  formatSize,
  formatDate,
  getFileIcon,
  highlightMatch,
} from "../../utils/fileHelpers";

const getFileLink = (file) => {
  if (file.isDirectory) {
    return file.path === "/" ? "/" : file.path;
  }
  return `/api/files${file.path}`;
};

const SearchChecksumDisplay = ({ file, query, onCopyChecksum, t }) => {
  // Always show "-" for directories, regardless of checksum value
  if (file.isDirectory) {
    return <span className="text-muted">-</span>;
  }

  // For files, check if checksum exists and is not "Pending"
  if (file.checksum && file.checksum !== "Pending") {
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
          title={t("files:file.copyFullChecksum")}
        >
          <i className="bi bi-clipboard" />
        </button>
      </div>
    );
  }

  // For files without valid checksum, show calculating spinner
  return (
    <div
      className="spinner-border spinner-border-sm text-warning"
      role="status"
    >
      <span className="visually-hidden">{t("files:file.calculating")}</span>
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
  t: PropTypes.func.isRequired,
};

const SearchResults = ({ results, query, onClear }) => {
  const { t } = useTranslation(["files", "common"]);

  const handleCopyChecksum = async (checksum) => {
    try {
      await navigator.clipboard.writeText(checksum);
    } catch (error) {
      console.error("Failed to copy checksum:", error);
    }
  };

  const handleCopyLink = async (file) => {
    try {
      const url = `${window.location.origin}${getFileLink(file)}`;
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const getContainingFolder = (filePath) => {
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash <= 0) {
      return "/";
    }
    return filePath.substring(0, lastSlash);
  };

  if (!results || !results.success) {
    return (
      <div className="card bg-dark border-0">
        <div className="card-body text-center py-5">
          <i className="bi bi-exclamation-triangle display-4 text-warning mb-3" />
          <h5 className="text-light">{t("files:search.searchFailed")}</h5>
          <p className="text-muted">
            {t("files:search.unableToPerformSearch")}
          </p>
          <button className="btn btn-outline-primary" onClick={onClear}>
            <i className="bi bi-arrow-left me-2" />
            {t("files:search.backToFiles")}
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
          <h5 className="text-light">{t("files:search.noResultsFound")}</h5>
          <p className="text-muted">
            {t("files:search.noFilesOrChecksumsFound", { query })}
          </p>
          <button className="btn btn-outline-primary" onClick={onClear}>
            <i className="bi bi-arrow-left me-2" />
            {t("files:search.backToFiles")}
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
          {t("files:search.searchResultsFor", { query, count: totalResults })}
        </h5>
      </div>
      <div className="table-responsive">
        <table className="table table-dark table-hover mb-0 search-results-table">
          <thead>
            <tr>
              <th scope="col">{t("files:search.name")}</th>
              <th scope="col">{t("files:search.path")}</th>
              <th scope="col">{t("files:search.size")}</th>
              <th scope="col">{t("files:search.modified")}</th>
              <th scope="col">{t("files:search.checksum")}</th>
              <th scope="col">{t("files:search.actions")}</th>
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
                    t={t}
                  />
                </td>
                <td>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      className="btn btn-outline-info"
                      onClick={() => handleCopyLink(file)}
                      title={
                        file.isDirectory
                          ? t("files:file.copyFolderLink")
                          : t("files:file.copyDownloadLink")
                      }
                    >
                      <i className="bi bi-link-45deg" />
                    </button>

                    {file.isDirectory ? (
                      <Link
                        to={getFileLink(file)}
                        className="btn btn-outline-primary"
                        title={t("files:search.openFolder")}
                      >
                        <i className="bi bi-folder2-open" />
                      </Link>
                    ) : (
                      <a
                        href={getFileLink(file)}
                        className="btn btn-outline-success"
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("files:search.downloadFile")}
                      >
                        <i className="bi bi-download" />
                      </a>
                    )}

                    {file.path !== "/" && (
                      <Link
                        to={getContainingFolder(file.path)}
                        className="btn btn-outline-secondary"
                        title={t("files:search.goToContainingFolder")}
                      >
                        <i className="bi bi-folder" />
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
