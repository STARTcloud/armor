import { useState, useEffect, useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import api from "../../utils/api";

import { useAuth } from "./AuthContext";

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [authMethods, setAuthMethods] = useState(null);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAuthMethods = useCallback(async () => {
    try {
      const oidcProvider = searchParams.get("oidc_provider");
      const authMethod = searchParams.get("auth_method");

      let url = "/auth/methods";
      const params = new URLSearchParams();
      if (oidcProvider) {
        params.append("oidc_provider", oidcProvider);
      }
      if (authMethod) {
        params.append("auth_method", authMethod);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await api.get(url);
      setAuthMethods(response.data);
    } catch (fetchError) {
      console.error("Failed to fetch auth methods:", fetchError);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAuthMethods();

    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");
    if (errorParam === "invalid_credentials" && messageParam) {
      setError(decodeURIComponent(messageParam));
    } else if (errorParam === "network_error") {
      setError("Network error occurred. Please try again.");
    }
  }, [searchParams, fetchAuthMethods]);

  const handleBasicAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login/basic", credentials);

      if (response.data.success) {
        const returnUrl = searchParams.get("return")
          ? decodeURIComponent(searchParams.get("return"))
          : "/";
        window.location.href = returnUrl;
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (loginError) {
      setError(loginError.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = (provider) => {
    const returnParam = searchParams.get("return")
      ? `?return=${encodeURIComponent(searchParams.get("return"))}`
      : "";
    window.location.href = `/auth/oidc/${provider}${returnParam}`;
  };

  const lightenColor = (color, amount = 0.3) => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
    const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
    const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB)
      .toString(16)
      .slice(1)}`;
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!authMethods) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-dark">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const title = "Armor";
  const subtitle = "ARMOR Reliably Manages Online Resources";
  const primaryColor = "#198754";

  const oidcMethods = authMethods.success
    ? authMethods.methods.filter(
        (method) => method.id.startsWith("oidc-") && method.enabled
      )
    : [];
  const hasBasicAuth = authMethods.success
    ? authMethods.methods.some(
        (method) => method.id === "basic" && method.enabled
      )
    : false;

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card bg-dark border-secondary">
              <div className="card-body p-4">
                <div className="text-center mb-4">
                  <i className="bi bi-shield-check display-4 text-success mb-3" />
                  <h2 className="text-light">{title}</h2>
                  <p className="text-muted">{subtitle}</p>
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {/* OIDC Providers */}
                {oidcMethods.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-light mb-3">Sign in with:</h5>
                    {oidcMethods.map((method) => {
                      const provider = method.id.replace("oidc-", "");
                      const baseColor = method.color || "#198754";
                      const lightColor = lightenColor(baseColor);

                      return (
                        <button
                          key={method.id}
                          type="button"
                          className="btn w-100 mb-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleOIDCLogin(provider)}
                          style={{
                            backgroundColor: "transparent",
                            borderColor: baseColor,
                            color: lightColor,
                          }}
                        >
                          <i className="bi bi-shield-lock me-2" />
                          {method.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Basic Auth Form */}
                {hasBasicAuth && (
                  <>
                    {oidcMethods.length > 0 && (
                      <div className="text-center mb-3">
                        <div className="position-relative">
                          <hr className="text-muted" />
                          <span className="position-absolute top-50 start-50 translate-middle bg-dark px-2 text-muted">
                            or
                          </span>
                        </div>
                      </div>
                    )}
                    <form onSubmit={handleBasicAuth}>
                      <div className="mb-3">
                        <label
                          htmlFor="username"
                          className="form-label text-light"
                        >
                          Username
                        </label>
                        <input
                          type="text"
                          className="form-control bg-dark border-secondary text-light"
                          id="username"
                          value={credentials.username}
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              username: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label
                          htmlFor="password"
                          className="form-label text-light"
                        >
                          Password
                        </label>
                        <input
                          type="password"
                          className="form-control bg-dark border-secondary text-light"
                          id="password"
                          value={credentials.password}
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              password: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn w-100"
                        style={{
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                        }}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                            />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </button>
                    </form>
                  </>
                )}

                <div className="text-center mt-4">
                  <small className="text-muted">
                    Powered by{" "}
                    <a
                      href="https://startcloud.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-decoration-none text-light"
                    >
                      STARTcloud
                    </a>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
