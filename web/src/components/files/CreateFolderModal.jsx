import PropTypes from "prop-types";
import { useState, useEffect } from "react";

const CreateFolderModal = ({ show, onHide, onCreateFolder }) => {
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (show) {
      setFolderName("");
      setValidationError("");
      setLoading(false);
    }
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setValidationError("Please enter a folder name");
      return;
    }

    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(folderName)) {
      setValidationError("Folder name contains invalid characters");
      return;
    }

    try {
      setLoading(true);
      setValidationError("");
      await onCreateFolder(folderName.trim());
    } catch (error) {
      setValidationError(error.message || "Failed to create folder");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onHide();
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content bg-dark border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-light">
              <i className="bi bi-folder-plus me-2" />
              Create New Folder
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onHide}
              aria-label="Close"
            />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {validationError && (
                <div className="alert alert-danger" role="alert">
                  {validationError}
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="folderName" className="form-label text-light">
                  Folder Name
                </label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  id="folderName"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter folder name"
                  disabled={loading}
                />
                <div className="form-text text-muted">
                  Folder names cannot contain: &lt; &gt; : &quot; / \ | ? *
                </div>
              </div>
            </div>
            <div className="modal-footer border-secondary">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onHide}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !folderName.trim()}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-folder-plus me-2" />
                    Create
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

CreateFolderModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onCreateFolder: PropTypes.func.isRequired,
};

export default CreateFolderModal;
