import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../utils/api";
import Footer from "../layout/Footer";

const getConfigValue = (config, uiKey, fallbackKey, defaultValue) =>
  config?.ui?.[uiKey] || config?.[fallbackKey] || defaultValue;

const getStyles = (primaryColor) => ({
  landingCard: {
    textAlign: "center",
    maxWidth: "500px",
    padding: "3rem",
    backgroundColor: "#343a40",
    border: "1px solid #495057",
    borderRadius: "0.5rem",
  },
  shieldIcon: {
    fontSize: "4rem",
    color: primaryColor,
    marginBottom: "1rem",
  },
  body: {
    backgroundColor: "#212529",
    color: "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  mainContent: {
    flex: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    width: "100%",
  },
});

const LandingPage = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.get("/auth/methods");
        setConfig(response.data);
      } catch (error) {
        console.error("Failed to load UI config:", error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const title = getConfigValue(
    config,
    "landing_title",
    "landing_title",
    "STARTcloud Armor"
  );
  const subtitle = getConfigValue(
    config,
    "landing_subtitle",
    "landing_subtitle",
    "ARMOR Reliably Manages Online Resources"
  );
  const description = getConfigValue(
    config,
    "landing_description",
    "landing_description",
    "This is a secured download site"
  );
  const iconClass = getConfigValue(
    config,
    "landing_icon_class",
    "landing_icon_class",
    "bi bi-shield-check"
  );
  const iconUrl = getConfigValue(
    config,
    "landing_icon_url",
    "landing_icon_url",
    null
  );
  const supportEmail = getConfigValue(
    config,
    "support_email",
    "support_email",
    "support@startcloud.com"
  );
  const primaryColor = getConfigValue(
    config,
    "login_primary_color",
    "login_primary_color",
    "#198754"
  );

  const styles = getStyles(primaryColor);

  return (
    <div style={styles.body}>
      <div style={styles.mainContent}>
        <div style={styles.landingCard}>
          <div style={styles.shieldIcon}>
            <button
              onClick={() => navigate("/?view=index")}
              style={{
                color: "inherit",
                textDecoration: "none",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "inherit",
              }}
              title="Click to access file index"
            >
              {iconUrl ? (
                <img src={iconUrl} alt={title} height="64" />
              ) : (
                <i className={iconClass} />
              )}
            </button>
          </div>
          <h1 className="display-4 mb-4">{title}</h1>
          <p className="lead mb-3">{description}</p>
          <p style={{ color: "#adb5bd" }}>{subtitle}</p>
          <hr className="my-4" />
          <p className="small" style={{ color: "#adb5bd" }}>
            <i className="bi bi-info-circle me-2" />
            Access to resources requires proper authentication
          </p>
          <div className="mt-4">
            <a
              href={`mailto:${supportEmail}`}
              className="btn btn-sm"
              style={{
                backgroundColor: "#212529",
                borderColor: "#212529",
                color: "white",
              }}
            >
              <i className="bi bi-envelope me-2" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
      <div style={styles.footer}>
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
