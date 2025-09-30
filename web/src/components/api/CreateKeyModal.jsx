import PropTypes from "prop-types";

const CreateKeyModal = ({
  show,
  createForm,
  userPermissions,
  onSubmit,
  onClose,
  onFormChange,
  error,
}) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-light">
              <i className="bi bi-plus-circle me-2" />
              Create New API Key
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>
          <form onSubmit={onSubmit}>
            <div className="modal-body">
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}
              <div className="mb-3">
                <label htmlFor="keyName" className="form-label text-light">
                  Key Name
                </label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  id="keyName"
                  value={createForm.name}
                  onChange={(e) =>
                    onFormChange({ ...createForm, name: e.target.value })
                  }
                  placeholder="Enter a descriptive name"
                  required
                />
              </div>

              <div className="mb-3">
                <label
                  htmlFor="keyPermissions"
                  className="form-label text-light"
                >
                  Permissions
                </label>
                <div id="keyPermissions">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      value="downloads"
                      id="perm-downloads"
                      checked={createForm.permissions.downloads}
                      onChange={(e) =>
                        onFormChange({
                          ...createForm,
                          permissions: {
                            ...createForm.permissions,
                            downloads: e.target.checked,
                          },
                        })
                      }
                    />
                    <label
                      className="form-check-label text-light"
                      htmlFor="perm-downloads"
                    >
                      Downloads
                    </label>
                    <small className="form-text text-muted d-block">
                      Access to download files
                    </small>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      value="uploads"
                      id="perm-uploads"
                      checked={createForm.permissions.uploads}
                      disabled={!userPermissions.includes("uploads")}
                      onChange={(e) =>
                        onFormChange({
                          ...createForm,
                          permissions: {
                            ...createForm.permissions,
                            uploads: e.target.checked,
                          },
                        })
                      }
                    />
                    <label
                      className="form-check-label text-light"
                      htmlFor="perm-uploads"
                      style={{
                        opacity: !userPermissions.includes("uploads")
                          ? "0.5"
                          : "1",
                      }}
                    >
                      Uploads
                    </label>
                    <small className="form-text text-muted d-block">
                      Access to upload files
                    </small>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      value="delete"
                      id="perm-delete"
                      checked={createForm.permissions.delete}
                      disabled={!userPermissions.includes("delete")}
                      onChange={(e) =>
                        onFormChange({
                          ...createForm,
                          permissions: {
                            ...createForm.permissions,
                            delete: e.target.checked,
                          },
                        })
                      }
                    />
                    <label
                      className="form-check-label text-light"
                      htmlFor="perm-delete"
                      style={{
                        opacity: !userPermissions.includes("delete")
                          ? "0.5"
                          : "1",
                      }}
                    >
                      Delete
                    </label>
                    <small className="form-text text-muted d-block">
                      Access to delete files
                    </small>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="keyExpiration"
                  className="form-label text-light"
                >
                  Expiration
                </label>
                <select
                  className="form-select bg-dark text-light border-secondary"
                  id="keyExpiration"
                  value={createForm.expirationDays || ""}
                  onChange={(e) =>
                    onFormChange({
                      ...createForm,
                      expirationDays: parseInt(e.target.value),
                    })
                  }
                  required
                >
                  <option value="">Select expiration period</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
                <small className="form-text text-muted">
                  API keys cannot be set to never expire
                </small>
              </div>
            </div>
            <div className="modal-footer border-secondary">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-plus-circle me-2" />
                Create Key
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

CreateKeyModal.propTypes = {
  show: PropTypes.bool.isRequired,
  createForm: PropTypes.shape({
    name: PropTypes.string.isRequired,
    permissions: PropTypes.shape({
      downloads: PropTypes.bool.isRequired,
      uploads: PropTypes.bool.isRequired,
      delete: PropTypes.bool.isRequired,
    }).isRequired,
    expirationDays: PropTypes.number,
  }).isRequired,
  userPermissions: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onFormChange: PropTypes.func.isRequired,
  error: PropTypes.string,
};

export default CreateKeyModal;
