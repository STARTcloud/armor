import { useAuth } from "../auth/AuthContext";
import { useLocation } from "react-router-dom";

import Breadcrumbs from "./Breadcrumbs";

const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

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
            <Breadcrumbs />
          </div>
          <div className="col-auto">
            <div className="dropdown">
              <button
                className="btn btn-outline-light dropdown-toggle"
                type="button"
                id="userDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                data-bs-auto-close="true"
              >
                <i className="bi bi-person-circle me-1" />
                {getUserDisplayName(user)}
              </button>
              <ul
                className="dropdown-menu dropdown-menu-end bg-dark border-secondary"
                aria-labelledby="userDropdown"
              >
                {location.pathname !== "/" && !location.pathname.includes("view=index") && (
                  <li>
                    <a className="dropdown-item text-light" href="/?view=index">
                      <i className="bi bi-shield me-2" />
                      Dashboard
                    </a>
                  </li>
                )}
                {location.pathname !== "/api-keys" && (
                  <li>
                    <a className="dropdown-item text-light" href="/api-keys">
                      <i className="bi bi-key me-2" />
                      API Keys
                    </a>
                  </li>
                )}
                {location.pathname !== "/api-docs" && (
                  <li>
                    <a
                      className="dropdown-item text-light"
                      href="/api-docs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="bi bi-book me-2" />
                      API Documentation
                    </a>
                  </li>
                )}
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
      </div>
    </header>
  );
};

export default Header;
