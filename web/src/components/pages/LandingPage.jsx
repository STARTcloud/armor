import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../utils/api";
import Footer from "../layout/Footer";

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

  const title =
    config?.ui?.landing_title || config?.landing_title || "STARTcloud Armor";
  const subtitle =
    config?.ui?.landing_subtitle ||
    config?.landing_subtitle ||
    "ARMOR Reliably Manages Online Resources";
  const description =
    config?.ui?.landing_description ||
    config?.landing_description ||
    "This is a secured download site";
  const iconClass =
    config?.ui?.landing_icon_class ||
    config?.landing_icon_class ||
    "bi bi-shield-check";
  const iconUrl = config?.ui?.landing_icon_url || config?.landing_icon_url;
  const supportEmail =
    config?.ui?.support_email ||
    config?.support_email ||
    "support@startcloud.com";
  const primaryColor = config?.ui?.login_primary_color || "#198754";

  const landingCardStyle = {
    textAlign: "center",
    maxWidth: "500px",
    padding: "3rem",
  };

  const shieldIconStyle = {
    fontSize: "4rem",
    color: primaryColor,
    marginBottom: "1rem",
  };

  const bodyStyle = {
    backgroundColor: "#212529",
    color: "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };

  const mainContentStyle = {
    flex: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const footerStyle = {
    width: "100%",
  };

  return (
    <div style={bodyStyle}>
      <div style={mainContentStyle}>
        <div style={landingCardStyle}>
          <div style={shieldIconStyle}>
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
          <p className="text-secondary">{subtitle}</p>
          <hr className="my-4" />
          <p className="small text-secondary">
            <i className="bi bi-info-circle me-2" />
            Access to resources requires proper authentication
          </p>
          <div className="mt-4">
            <a
              href={`mailto:${supportEmail}`}
              className="btn btn-outline-light btn-sm"
            >
              <i className="bi bi-envelope me-2" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
      <div style={footerStyle}>
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
