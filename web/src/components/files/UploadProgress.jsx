import PropTypes from "prop-types";

const UploadProgress = ({ upload, onRemove, onRetry }) => {
  const getStatusIcon = () => {
    switch (upload.status) {
      case "pending":
        return "bi-clock text-warning";
      case "uploading":
        return "bi-arrow-up-circle text-primary";
      case "completed":
        return "bi-check-circle text-success";
      case "error":
        return "bi-exclamation-circle text-danger";
      default:
        return "bi-file-earmark text-muted";
    }
  };

  const getProgressBarClass = () => {
    switch (upload.status) {
      case "completed":
        return "bg-success";
      case "error":
        return "bg-danger";
      case "uploading":
        return "bg-primary";
      default:
        return "bg-secondary";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) {
      return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="list-group-item bg-dark border-secondary">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="d-flex align-items-center flex-grow-1">
          <i className={`bi ${getStatusIcon()} me-2`} />
          <div className="flex-grow-1">
            <div className="text-light fw-medium">{upload.file.name}</div>
            <small className="text-muted">
              {formatFileSize(upload.file.size)}
              {upload.status === "uploading" && ` • ${upload.progress}%`}
              {upload.status === "error" && upload.error
                ? ` • ${upload.error}`
                : null}
            </small>
          </div>
        </div>
        <div className="btn-group btn-group-sm ms-2">
          {upload.status === "error" && (
            <button
              className="btn btn-outline-warning"
              onClick={() => onRetry(upload)}
              title="Retry upload"
            >
              <i className="bi bi-arrow-clockwise" />
            </button>
          )}
          <button
            className="btn btn-outline-secondary"
            onClick={() => onRemove(upload.id)}
            title="Remove from list"
          >
            <i className="bi bi-x" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {(upload.status === "uploading" || upload.status === "completed") && (
        <div className="progress" style={{ height: "4px" }}>
          <div
            className={`progress-bar ${getProgressBarClass()}`}
            role="progressbar"
            style={{ width: `${upload.progress}%` }}
            aria-valuenow={upload.progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      )}
    </div>
  );
};

UploadProgress.propTypes = {
  upload: PropTypes.shape({
    id: PropTypes.string.isRequired,
    file: PropTypes.shape({
      name: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
    }).isRequired,
    status: PropTypes.string.isRequired,
    progress: PropTypes.number,
    error: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
};

export default UploadProgress;
