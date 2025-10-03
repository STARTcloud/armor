import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const ChecksumProgress = ({ progressData }) => {
  const { t } = useTranslation(["files", "common"]);

  // Don't render if no progress data or not visible
  if (
    !progressData ||
    (!progressData.isActive &&
      progressData.pending === 0 &&
      progressData.generating === 0 &&
      progressData.error === 0)
  ) {
    return null;
  }

  const getProgressBarColor = () => {
    if (progressData.error > 0) {
      return "bg-danger";
    }
    if (progressData.generating > 0 || progressData.pending > 0) {
      return "bg-warning";
    }
    return "bg-success";
  };

  const getStatusText = () => {
    if (progressData.generating > 0) {
      return t("files:checksum.generating", { count: progressData.generating });
    }
    if (progressData.pending > 0) {
      return t("files:checksum.pending", { count: progressData.pending });
    }
    if (progressData.error > 0) {
      return t("files:checksum.errors", { count: progressData.error });
    }
    return t("files:checksum.complete");
  };

  return (
    <div className="mt-4 p-3 bg-dark border rounded">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 text-light">
          <i className="bi bi-shield-check me-2" />
          {t("files:checksum.title")}
        </h6>
        <small className="text-light">
          {progressData.complete} / {progressData.total}{" "}
          {t("files:checksum.files")}
        </small>
      </div>

      <div className="progress mb-2" style={{ height: "8px" }}>
        <div
          className={`progress-bar ${getProgressBarColor()}`}
          role="progressbar"
          style={{ width: `${progressData.percentage}%` }}
          aria-valuenow={progressData.percentage}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <small className="text-light">
            <strong>{progressData.percentage.toFixed(1)}%</strong>
          </small>

          {progressData.activeProcessing > 0 ? (
            <small className="text-primary">
              <i
                className="bi bi-gear-fill me-1"
                style={{
                  animation: "spin 1s linear infinite",
                }}
              />
              {t("files:checksum.processing", {
                count: progressData.activeProcessing,
              })}
            </small>
          ) : null}

          <small className="text-light">{getStatusText()}</small>
        </div>

        {progressData.error > 0 ? (
          <small className="text-danger">
            <i className="bi bi-exclamation-triangle me-1" />
            {progressData.error} {t("files:checksum.failed")}
          </small>
        ) : null}
      </div>
    </div>
  );
};

ChecksumProgress.propTypes = {
  progressData: PropTypes.shape({
    isActive: PropTypes.bool,
    pending: PropTypes.number,
    generating: PropTypes.number,
    error: PropTypes.number,
    complete: PropTypes.number,
    total: PropTypes.number,
    percentage: PropTypes.number,
    activeProcessing: PropTypes.number,
  }),
};

ChecksumProgress.defaultProps = {
  progressData: null,
};

export default ChecksumProgress;
