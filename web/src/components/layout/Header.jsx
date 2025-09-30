import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { getSupportedLanguages } from "../../i18n";
import { useAuth } from "../auth/AuthContext";

import Breadcrumbs from "./Breadcrumbs";

const Header = () => {
  const { user, logout, logoutLocal } = useAuth();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setShowLanguageModal(false);
  };

  // Get language display name
  const getLanguageDisplayName = (languageCode) => {
    const languageNames = {
      en: "English",
      es: "Español",
      fr: "Français",
      de: "Deutsch",
      it: "Italiano",
      pt: "Português",
      ru: "Русский",
      zh: "中文",
      ja: "日本語",
      ko: "한국어",
      ar: "العربية",
      hi: "हिन्दी",
      nl: "Nederlands",
      sv: "Svenska",
      da: "Dansk",
      no: "Norsk",
      fi: "Suomi",
      pl: "Polski",
      cs: "Čeština",
      hu: "Magyar",
      ro: "Română",
      bg: "Български",
      hr: "Hrvatski",
      sk: "Slovenčina",
      sl: "Slovenščina",
      et: "Eesti",
      lv: "Latviešu",
      lt: "Lietuvių",
      el: "Ελληνικά",
      tr: "Türkçe",
      he: "עברית",
      th: "ไทย",
      vi: "Tiếng Việt",
      id: "Bahasa Indonesia",
      ms: "Bahasa Melayu",
      tl: "Filipino",
      sw: "Kiswahili",
    };

    return languageNames[languageCode] || languageCode.toUpperCase();
  };

  // Get supported languages from i18n
  const supportedLanguages = getSupportedLanguages();

  const getUserDisplayName = (userInfo) => {
    if (!userInfo) {
      return t("user.unknownUser");
    }

    if (userInfo.authType === "api_key") {
      return t("user.apiKey", { keyName: userInfo.keyName || "Unnamed" });
    }

    if (userInfo.authType === "basic") {
      return userInfo.username || t("user.basicAuthUser");
    }

    if (userInfo.authType === "jwt" && userInfo.oidcUser) {
      const oidc = userInfo.oidcUser;
      return (
        oidc.name || oidc.email || oidc.preferred_username || t("user.oidcUser")
      );
    }

    return userInfo.username || t("user.user");
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
                {location.pathname !== "/" &&
                  !location.pathname.includes("view=index") && (
                    <li>
                      <a
                        className="dropdown-item text-light"
                        href="/?view=index"
                      >
                        <i className="bi bi-shield me-2" />
                        {t("navigation.dashboard")}
                      </a>
                    </li>
                  )}
                {location.pathname !== "/api-keys" && (
                  <li>
                    <a className="dropdown-item text-light" href="/api-keys">
                      <i className="bi bi-key me-2" />
                      {t("navigation.apiKeys")}
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
                      {t("navigation.apiDocumentation")}
                    </a>
                  </li>
                )}
                <li>
                  <hr className="dropdown-divider border-secondary" />
                </li>
                <li>
                  <button
                    className="dropdown-item text-light"
                    onClick={() => setShowLanguageModal(true)}
                  >
                    <i className="bi bi-globe me-2" />
                    {t("language.selectLanguage")}
                  </button>
                </li>
                <li>
                  <hr className="dropdown-divider border-secondary" />
                </li>
                <li>
                  <button className="dropdown-item text-light" onClick={logout}>
                    <i className="bi bi-box-arrow-right me-2" />
                    {t("navigation.logout")}
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item text-light"
                    onClick={logoutLocal}
                  >
                    <i className="bi bi-box-arrow-left me-2" />
                    {t("navigation.logoutLocal")}
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal ? (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-light">
                  <i className="bi bi-globe me-2" />
                  {t("language.changeLanguage")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowLanguageModal(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="list-group list-group-flush">
                  {supportedLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`list-group-item list-group-item-action bg-dark text-light border-secondary d-flex justify-content-between align-items-center ${
                        i18n.language === lang ? "active" : ""
                      }`}
                      onClick={() => changeLanguage(lang)}
                    >
                      <span>
                        <i className="bi bi-globe me-2" />
                        {getLanguageDisplayName(lang)}
                      </span>
                      {i18n.language === lang && (
                        <i className="bi bi-check-circle text-success" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLanguageModal(false)}
                >
                  {t("buttons.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Header;
