import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

import {
  formatDate,
  isExpired,
  getPermissionBadges,
} from "../../utils/fileHelpers";

const ApiKeysTable = ({
  sortedKeys,
  selectedKeys,
  sortField,
  sortDirection,
  onSelectAll,
  onSort,
  onSelectionChange,
  onDeleteKey,
  onRetrieveFullKey,
}) => {
  const { t } = useTranslation(["api", "common"]);

  return (
    <div id="apiKeysTable" className="api-keys-table">
      <div className="card bg-dark border-secondary">
        <div className="card-header bg-dark border-secondary">
          <h5 className="mb-0 text-light">
            <i className="bi bi-key-fill me-2" />
            {t("api:keys.apiKeysTotal", { count: sortedKeys?.length || 0 })}
          </h5>
        </div>
        <div className="table-responsive">
          <table className="table table-dark table-striped table-hover mb-0">
            <thead>
              <tr>
                <th scope="col" style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={
                      sortedKeys.length > 0 &&
                      selectedKeys.length === sortedKeys.length
                    }
                    ref={(input) => {
                      if (input) {
                        input.indeterminate =
                          selectedKeys.length > 0 &&
                          selectedKeys.length < sortedKeys.length;
                      }
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    title={t("common:actions.selectAll")}
                  />
                </th>
                <th
                  scope="col"
                  className="cursor-pointer user-select-none"
                  onClick={() => onSort("name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSort("name");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by name"
                >
                  {t("api:keys.name")}{" "}
                  {sortField === "name" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"} ms-1`}
                    />
                  )}
                </th>
                <th scope="col">{t("api:keys.keyPreview")}</th>
                <th scope="col">{t("api:keys.permissions")}</th>
                <th
                  scope="col"
                  className="cursor-pointer user-select-none"
                  onClick={() => onSort("expires_at")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSort("expires_at");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by expiration date"
                >
                  {t("api:keys.expires")}{" "}
                  {sortField === "expires_at" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"} ms-1`}
                    />
                  )}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer user-select-none"
                  onClick={() => onSort("last_used")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSort("last_used");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Sort by last used date"
                >
                  {t("api:keys.lastUsed")}{" "}
                  {sortField === "last_used" && (
                    <i
                      className={`bi bi-arrow-${sortDirection === "asc" ? "up" : "down"} ms-1`}
                    />
                  )}
                </th>
                <th scope="col" width="120">
                  {t("api:keys.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedKeys.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <i className="bi bi-key display-4 text-muted mb-3 d-block" />
                    <h5 className="text-muted">
                      {t("api:messages.noApiKeys")}
                    </h5>
                    <p className="text-muted">
                      {t("api:messages.createFirstApiKey")}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedKeys.map((key) => {
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
                          onChange={(e) =>
                            onSelectionChange(key.id, e.target.checked)
                          }
                          title={t("api:messages.selectKey", {
                            keyName: key.name,
                          })}
                        />
                      </td>
                      <td>
                        {key.name}
                        {expired ? (
                          <span className="badge bg-danger ms-2">
                            {t("api:status.expired")}
                          </span>
                        ) : null}
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
                              ? () => onRetrieveFullKey(key.id)
                              : undefined
                          }
                          onKeyDown={
                            key.is_retrievable && !expired
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onRetrieveFullKey(key.id);
                                  }
                                }
                              : undefined
                          }
                          tabIndex={key.is_retrievable && !expired ? 0 : -1}
                          role={
                            key.is_retrievable && !expired
                              ? "button"
                              : undefined
                          }
                          title={
                            key.is_retrievable && !expired
                              ? t("api:messages.clickToViewCopyKey")
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
                        {key.expires_at
                          ? formatDate(key.expires_at)
                          : t("api:keys.never")}
                      </td>
                      <td>{formatDate(key.last_used || key.lastUsedAt)}</td>
                      <td>
                        <button
                          className="btn btn-outline-danger btn-sm delete-key-btn"
                          onClick={() => onDeleteKey(key.id)}
                          title={t("api:messages.deleteApiKeyTooltip")}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

ApiKeysTable.propTypes = {
  sortedKeys: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  sortField: PropTypes.string.isRequired,
  sortDirection: PropTypes.string.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  onSort: PropTypes.func.isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  onDeleteKey: PropTypes.func.isRequired,
  onRetrieveFullKey: PropTypes.func.isRequired,
};

export default ApiKeysTable;
