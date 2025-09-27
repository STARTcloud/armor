import { useState, useEffect } from "react";

import api from "../../utils/api";
import ConfirmModal from "../common/ConfirmModal";
import SearchBar from "../search/SearchBar";
import "./api-keys.css";

const ApiKeysPage = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredKeys, setFilteredKeys] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    permissions: {
      downloads: true,
      uploads: false,
      delete: false,
    },
    expiresAt: "",
    expirationDays: 30,
  });

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/api/api-keys");
      if (response.data.success) {
        setApiKeys(response.data.api_keys || []);
      } else {
        setError(response.data.message || "Failed to load API keys");
      }
    } catch (loadError) {
      console.error("Failed to load API keys:", loadError);
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async () => {
    try {
      const response = await api.get("/api/user-api-keys");
      if (response.data.success) {
        setUserPermissions(response.data.user_permissions || []);
      }
    } catch (err) {
      console.error("Failed to load user permissions:", err);
      setUserPermissions(["downloads"]);
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
      const expirationDate = createForm.expirationDays
        ? new Date(
            Date.now() + createForm.expirationDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : createForm.expiresAt || null;

      const response = await api.post("/api/api-keys", {
        name: createForm.name.trim(),
        permissions: Object.keys(createForm.permissions).filter(
          (key) => createForm.permissions[key]
        ),
        expires_at: expirationDate,
      });

      setNewKeyData(response.data.api_key);
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
        expirationDays: 30,
      });

      loadApiKeys();
    } catch (createError) {
      console.error("Failed to create API key:", createError);
      setError(
        createError.response?.data?.message || "Failed to create API key"
      );
    }
  };

  const handleDeleteKey = (keyId) => {
    setKeyToDelete(keyId);
    setShowDeleteConfirm(true);
  };

  const handleBulkDelete = () => {
    if (selectedKeys.length > 0) {
      setShowBulkDeleteConfirm(true);
    }
  };

  const confirmBulkDelete = async () => {
    try {
      await Promise.all(
        selectedKeys.map((keyId) => api.delete(`/api/api-keys/${keyId}`))
      );
      await loadApiKeys();
      setSelectedKeys([]);
      setShowBulkDeleteConfirm(false);
    } catch (deleteError) {
      console.error("Failed to delete API keys:", deleteError);
      setError("Failed to delete some API keys");
      setShowBulkDeleteConfirm(false);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteConfirm(false);
  };

  const handleSelectionChange = (keyId, isSelected) => {
    if (isSelected) {
      setSelectedKeys([...selectedKeys, keyId]);
    } else {
      setSelectedKeys(selectedKeys.filter((id) => id !== keyId));
    }
  };

  const handleSelectAll = (selectAll) => {
    if (selectAll) {
      const allKeyIds = sortedKeys.map((key) => key.id);
      setSelectedKeys(allKeyIds);
    } else {
      setSelectedKeys([]);
    }
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) {
      return;
    }

    try {
      await api.delete(`/api/api-keys/${keyToDelete}`);
      loadApiKeys();
      setShowDeleteConfirm(false);
      setKeyToDelete(null);
    } catch (deleteError) {
      console.error("Failed to delete API key:", deleteError);
      setError(
        deleteError.response?.data?.message || "Failed to delete API key"
      );
    }
  };

  const cancelDeleteKey = () => {
    setShowDeleteConfirm(false);
    setKeyToDelete(null);
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
    if (Array.isArray(permissions)) {
      return permissions;
    }
    if (permissions.downloads) {
      badges.push("downloads");
    }
    if (permissions.uploads) {
      badges.push("uploads");
    }
    if (permissions.delete) {
      badges.push("delete");
    }
    return badges;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredKeys([]);
      return;
    }

    const filtered = apiKeys.filter(
      (key) =>
        key.name.toLowerCase().includes(query.toLowerCase()) ||
        key.key_preview.toLowerCase().includes(query.toLowerCase()) ||
        getPermissionBadges(key.permissions).some((perm) =>
          perm.toLowerCase().includes(query.toLowerCase())
        )
    );
    setFilteredKeys(filtered);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setFilteredKeys([]);
  };

  const handleSort = (field) => {
    const direction =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(direction);
  };

  const sortedKeys = (searchQuery ? filteredKeys : apiKeys).sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "name") {
      aVal = aVal?.toLowerCase() || "";
      bVal = bVal?.toLowerCase() || "";
    } else if (
      sortField === "created_at" ||
      sortField === "expires_at" ||
      sortField === "last_used"
    ) {
      aVal = aVal ? new Date(aVal) : new Date(0);
      bVal = bVal ? new Date(bVal) : new Date(0);
    }

    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const retrieveFullKey = async (keyId) => {
    try {
      const response = await api.get(`/api/api-keys/${keyId}/full`);
      if (response.data.success) {
        await navigator.clipboard.writeText(response.data.full_key);

        const toast = document.createElement("div");
        toast.className =
          "position-fixed top-0 start-50 translate-middle-x mt-3 alert alert-success";
        toast.style.zIndex = "9999";
        toast.innerHTML =
          '<i class="bi bi-check-circle me-2"></i>API key copied to clipboard!';
        document.body.appendChild(toast);

        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 3000);
      } else {
        setError(`Failed to retrieve full key: ${response.data.message}`);
      }
    } catch (retrieveError) {
      setError(`Failed to retrieve full key: ${retrieveError.message}`);
    }
  };

  useEffect(() => {
    loadApiKeys();
    loadUserPermissions();
  }, []);

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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setShowCreateModal(true)}
            title="Generate New API Key"
          >
            <i className="bi bi-key" />
          </button>
          {selectedKeys.length > 0 && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleBulkDelete}
              title={`Delete ${selectedKeys.length} selected API key${selectedKeys.length > 1 ? 's' : ''}`}
            >
              <i className="bi bi-trash me-1" />
              ({selectedKeys.length})
            </button>
          )}
        </div>
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          value={searchQuery}
        />
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

      <div id="apiKeysTable" className="api-keys-table">
        {sortedKeys.length === 0 && !loading ? (
          <div className="text-center py-4">
            <i className="bi bi-key display-4 text-muted" />
            <h5 className="mt-3 text-muted">No API Keys</h5>
            <p className="text-muted">
              Create your first API key to get started
            </p>
          </div>
        ) : (
          <table className="table table-dark table-striped">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={sortedKeys.length > 0 && selectedKeys.length === sortedKeys.length}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = selectedKeys.length > 0 && selectedKeys.length < sortedKeys.length;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    title="Select all API keys"
                  />
                </th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("name");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by name"
                >
                  Name{" "}
                  {sortField === "name" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"}`}
                    />
                  )}
                </th>
                <th>Key Preview</th>
                <th>Permissions</th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("expires_at")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("expires_at");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by expiration date"
                >
                  Expires{" "}
                  {sortField === "expires_at" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"}`}
                    />
                  )}
                </th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("last_used")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSort("last_used");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by last used date"
                >
                  Last Used{" "}
                  {sortField === "last_used" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"}`}
                    />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedKeys.map((key) => {
                const expired = isExpired(key.expires_at);
                const expiredClass = expired ? "expired" : "";

                return (
                  <tr
                    key={key.id}
                    className={expiredClass}
                    style={expired ? { opacity: 0.6 } : {}}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedKeys.includes(key.id)}
                        onChange={(e) => handleSelectionChange(key.id, e.target.checked)}
                        title={`Select ${key.name}`}
                      />
                    </td>
                    <td>
                      {key.name}
                      {expired && (
                        <span className="badge bg-danger ms-2">Expired</span>
                      )}
                    </td>
                    <td>
                      <code
                        className="key-preview"
                        style={
                          key.is_retrievable && !expired
                            ? {
                                cursor: "pointer",
                                textDecoration: "underline",
                                fontFamily: "monospace",
                              }
                            : { fontFamily: "monospace" }
                        }
                        onClick={
                          key.is_retrievable && !expired
                            ? () => retrieveFullKey(key.id)
                            : undefined
                        }
                        onKeyDown={
                          key.is_retrievable && !expired
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  retrieveFullKey(key.id);
                                }
                              }
                            : undefined
                        }
                        tabIndex={key.is_retrievable && !expired ? 0 : -1}
                        role={
                          key.is_retrievable && !expired ? "button" : undefined
                        }
                        title={
                          key.is_retrievable && !expired
                            ? "Click to view/copy full key"
                            : ""
                        }
                      >
                        {key.key_preview || key.keyPrefix}...
                      </code>
                    </td>
                    <td>
                      {getPermissionBadges(key.permissions).map(
                        (permission) => (
                          <span
                            key={permission}
                            className={`badge me-1 permission-${permission}`}
                          >
                            {permission}
                          </span>
                        )
                      )}
                    </td>
                    <td>
                      {key.expires_at ? formatDate(key.expires_at) : "Never"}
                    </td>
                    <td>{formatDate(key.last_used || key.lastUsedAt)}</td>
                    <td>
                      <button
                        className="btn btn-outline-danger btn-sm delete-key-btn"
                        onClick={() => handleDeleteKey(key.id)}
                        title="Delete API key"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
                        setCreateForm({
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
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
                  <label
                    htmlFor="api-key-display"
                    className="form-label text-light"
                  >
                    API Key
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      id="api-key-display"
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
                  <pre
                    className="bg-secondary p-3 rounded"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  >
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        title="Delete API Key"
        message="Are you sure you want to delete this API key? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteKey}
        onCancel={cancelDeleteKey}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        show={showBulkDeleteConfirm}
        title="Delete Multiple API Keys"
        message={`Are you sure you want to delete ${selectedKeys.length} API key${selectedKeys.length > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText={`Delete ${selectedKeys.length} Key${selectedKeys.length > 1 ? 's' : ''}`}
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={cancelBulkDelete}
      />
    </div>
  );
};

export default ApiKeysPage;
