import { useAuth } from "../auth/AuthContext";

import Breadcrumbs from "./Breadcrumbs";

const Header = () => {
  const { user, logout } = useAuth();

  const getUserDisplayName = (userInfo) => {
    if (!userInfo) {
      return "Unknown User";
    }

    if (userInfo.authType === "api_key") {
      return `API Key: ${userInfo.keyName || "Unnamed"}`;
    }

    if (userInfo.authType === "basic") {
      return userInfo.username || "Basic Auth User";
    }

    if (userInfo.authType === "jwt" && userInfo.oidcUser) {
      const oidc = userInfo.oidcUser;
      return oidc.name || oidc.email || oidc.preferred_username || "OIDC User";
    }

    return userInfo.username || "User";
  };

  return (
    <header className="bg-dark border-bottom border-secondary">
      <div className="container-fluid">
        <div className="row align-items-center py-3">
          <div className="col">
            <div className="d-flex align-items-center">
              <i className="bi bi-shield-check text-success me-2 fs-4" />
              <h1 className="h4 mb-0 text-light">Armor</h1>
              <small className="text-muted ms-2">
                ARMOR Reliably Manages Online Resources
              </small>
            </div>
          </div>
          <div className="col-auto">
            <div className="dropdown">
              <button
                className="btn btn-outline-light dropdown-toggle"
                type="button"
                id="userDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="bi bi-person-circle me-1" />
                {getUserDisplayName(user)}
              </button>
              <ul
                className="dropdown-menu dropdown-menu-end bg-dark border-secondary"
                aria-labelledby="userDropdown"
              >
                <li>
                  <a className="dropdown-item text-light" href="/api-keys">
                    <i className="bi bi-key me-2" />
                    API Keys
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown-item text-light"
                    href="/api/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bi bi-book me-2" />
                    API Documentation
                  </a>
                </li>
                <li>
                  <hr className="dropdown-divider border-secondary" />
                </li>
                <li>
                  <button className="dropdown-item text-light" onClick={logout}>
                    <i className="bi bi-box-arrow-right me-2" />
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="row">
          <div className="col">
            <Breadcrumbs />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
