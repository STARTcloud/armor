import { useState } from "react";

import api from "../../utils/api";

const ApiKeysPage = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    permissions: {
      downloads: true,
      uploads: false,
      delete: false,
    },
    expiresAt: "",
  });

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/api/keys");
      setApiKeys(response.data.keys || []);
    } catch (loadError) {
      console.error("Failed to load API keys:", loadError);
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();

    if (!createForm.name.trim()) {
      setError("Please enter a key name");
      return;
    }

    try {
      setError("");
      const response = await api.post("/api/keys", {
        name: createForm.name.trim(),
        permissions: createForm.permissions,
        expiresAt: createForm.expiresAt || null,
      });

      setNewKeyData(response.data);
      setShowCreateModal(false);
      setShowKeyModal(true);
      setCreateForm({
        name: "",
        permissions: {
          downloads: true,
          uploads: false,
          delete: false,
        },
        expiresAt: "",
      });

      loadApiKeys();
    } catch (createError) {
      console.error("Failed to create API key:", createError);
      setError(
        createError.response?.data?.message || "Failed to create API key"
      );
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this API key? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/keys/${keyId}`);
      loadApiKeys();
    } catch (deleteError) {
      console.error("Failed to delete API key:", deleteError);
      setError(
        deleteError.response?.data?.message || "Failed to delete API key"
      );
    }
  };

  const handleCopyKey = async (key) => {
    try {
      await navigator.clipboard.writeText(key);
    } catch (copyError) {
      console.error("Failed to copy API key:", copyError);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Never";
    }
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) {
      return false;
    }
    return new Date(expiresAt) < new Date();
  };

  const getPermissionBadges = (permissions) => {
    const badges = [];
    if (permissions.downloads) {
      badges.push("Downloads");
    }
    if (permissions.uploads) {
      badges.push("Uploads");
    }
    if (permissions.delete) {
      badges.push("Delete");
    }
    return badges;
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col">
          <h2 className="text-light mb-3">
            <i className="bi bi-key me-2" />
            API Keys Management
          </h2>
          <p className="text-muted">
            Create and manage API keys for programmatic access to your files.
          </p>
        </div>
        <div className="col-auto">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="bi bi-plus-circle me-2" />
            Create New Key
          </button>
        </div>
      </div>

      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError("")}
            aria-label="Close"
          />
        </div>
      )}

      {/* API Keys List */}
      <div className="card bg-dark border-secondary">
        <div className="card-header bg-dark border-secondary">
          <h5 className="mb-0 text-light">Your API Keys ({apiKeys.length})</h5>
        </div>
        <div className="card-body">
          {apiKeys.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-key display-4 text-muted mb-3" />
              <h5 className="text-light">No API Keys</h5>
              <p className="text-muted">
                Create your first API key to get started with programmatic
                access.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <i className="bi bi-plus-circle me-2" />
                Create API Key
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Created</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Last Used</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr
                      key={key.id}
                      className={
                        isExpired(key.expiresAt) ? "table-warning" : ""
                      }
                    >
                      <td>
                        <div className="d-flex align-items-center">
                          <i className="bi bi-key me-2 text-primary" />
                          <div>
                            <div className="text-light fw-medium">
                              {key.name}
                            </div>
                            <small className="text-muted">
                              {key.keyPrefix}...
                              {isExpired(key.expiresAt) && (
                                <span className="badge bg-warning text-dark ms-2">
                                  Expired
                                </span>
                              )}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {getPermissionBadges(key.permissions).map(
                          (permission) => (
                            <span
                              key={permission}
                              className="badge bg-secondary me-1"
                            >
                              {permission}
                            </span>
                          )
                        )}
                      </td>
                      <td className="text-muted">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="text-muted">
                        {key.expiresAt ? (
                          <span
                            className={
                              isExpired(key.expiresAt) ? "text-warning" : ""
                            }
                          >
                            {formatDate(key.expiresAt)}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </td>
                      <td className="text-muted">
                        {formatDate(key.lastUsedAt)}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteKey(key.id)}
                          title="Delete API key"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
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
                  onClick={() => setShowCreateModal(false)}
                  aria-label="Close"
                />
              </div>
              <form onSubmit={handleCreateKey}>
                <div className="modal-body">
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
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder="Enter a descriptive name"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-light">Permissions</label>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="permDownloads"
                        checked={createForm.permissions.downloads}
                        onChange={(e) =>
                          setCreateForm({
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
                        htmlFor="permDownloads"
                      >
                        Downloads - Allow downloading files
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="permUploads"
                        checked={createForm.permissions.uploads}
                        onChange={(e) =>
                          setCreateForm({
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
                        htmlFor="permUploads"
                      >
                        Uploads - Allow uploading files
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="permDelete"
                        checked={createForm.permissions.delete}
                        onChange={(e) =>
                          setCreateForm({
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
                        htmlFor="permDelete"
                      >
                        Delete - Allow deleting files and folders
                      </label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="expiresAt"
                      className="form-label text-light"
                    >
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      className="form-control bg-dark text-light border-secondary"
                      id="expiresAt"
                      value={createForm.expiresAt}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          expiresAt: e.target.value,
                        })
                      }
                    />
                    <div className="form-text text-muted">
                      Leave empty for keys that never expire
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
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
      )}

      {/* Show New Key Modal */}
      {showKeyModal && newKeyData && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-light">
                  <i className="bi bi-check-circle text-success me-2" />
                  API Key Created Successfully
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowKeyModal(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="alert alert-warning" role="alert">
                  <i className="bi bi-exclamation-triangle me-2" />
                  <strong>Important:</strong> This is the only time you&apos;ll
                  see the full API key. Make sure to copy it now and store it
                  securely.
                </div>

                <div className="mb-3">
                  <label className="form-label text-light">API Key</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      value={newKeyData.key}
                      readOnly
                    />
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => handleCopyKey(newKeyData.key)}
                      title="Copy to clipboard"
                    >
                      <i className="bi bi-clipboard" />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="text-light">Usage Example:</h6>
                  <pre className="bg-secondary p-3 rounded">
                    <code className="text-light">
                      {`curl -H "Authorization: Bearer ${newKeyData.key}" \\
     ${window.location.origin}/api/files/`}
                    </code>
                  </pre>
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowKeyModal(false)}
                >
                  I&apos;ve Saved the Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeysPage;
