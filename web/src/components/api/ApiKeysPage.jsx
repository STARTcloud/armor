import { useState, useEffect } from "react";

import api from "../../utils/api";
import { getPermissionBadges, sortApiKeys } from "../../utils/fileHelpers";
import ConfirmModal from "../common/ConfirmModal";
import SearchBar from "../search/SearchBar";

import ApiKeysTable from "./ApiKeysTable";
import CreateKeyModal from "./CreateKeyModal";

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

  const resetCreateForm = () => {
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
  };

  const calculateExpirationDate = () =>
    createForm.expirationDays
      ? new Date(
          Date.now() + createForm.expirationDays * 24 * 60 * 60 * 1000
        ).toISOString()
      : createForm.expiresAt || null;

  const handleCreateKey = async (e) => {
    e.preventDefault();

    if (!createForm.name.trim()) {
      setError("Please enter a key name");
      return;
    }

    try {
      setError("");
      const expirationDate = calculateExpirationDate();

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
      resetCreateForm();
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
      const currentKeys = searchQuery ? filteredKeys : apiKeys;
      const allKeyIds = currentKeys.map((key) => key.id);
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

  const sortedKeys = sortApiKeys(
    searchQuery ? filteredKeys : apiKeys,
    sortField,
    sortDirection
  );

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
              title={`Delete ${selectedKeys.length} selected API key${selectedKeys.length > 1 ? "s" : ""}`}
            >
              <i className="bi bi-trash me-1" />({selectedKeys.length})
            </button>
          )}
        </div>
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          value={searchQuery}
        />
      </div>

      {Boolean(error) && (
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

      <ApiKeysTable
        sortedKeys={sortedKeys}
        selectedKeys={selectedKeys}
        sortField={sortField}
        sortDirection={sortDirection}
        onSelectAll={handleSelectAll}
        onSort={handleSort}
        onSelectionChange={handleSelectionChange}
        onDeleteKey={handleDeleteKey}
        onRetrieveFullKey={retrieveFullKey}
      />

      <CreateKeyModal
        show={showCreateModal}
        createForm={createForm}
        userPermissions={userPermissions}
        onSubmit={handleCreateKey}
        onClose={() => setShowCreateModal(false)}
        onFormChange={setCreateForm}
        error={error}
      />

      {/* Show New Key Modal */}
      {Boolean(showKeyModal && newKeyData) && (
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
        message={`Are you sure you want to delete ${selectedKeys.length} API key${selectedKeys.length > 1 ? "s" : ""}? This action cannot be undone.`}
        confirmText={`Delete ${selectedKeys.length} Key${selectedKeys.length > 1 ? "s" : ""}`}
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={cancelBulkDelete}
      />
    </div>
  );
};

export default ApiKeysPage;
