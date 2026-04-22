import PropTypes from "prop-types";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";

import api from "../../utils/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { t } = useTranslation(["auth", "common"]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await api.get("/auth/status");
      if (response.data.authenticated) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Auth status check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (credentials) => {
    try {
      const response = await api.post("/auth/login/basic", credentials);
      if (response.data.success) {
        // Re-fetch user data to get permissions
        await checkAuthStatus();
        return { success: true };
      }
      return { success: false, error: response.data.message };
    } catch (error) {
      console.error("Login failed:", error);
      return {
        success: false,
        error: error.response?.data?.message || t("auth:errors.loginFailed"),
      };
    }
  };

  const handleLocalLogoutRedirect = () => {
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/login";
  };

  const logout = async () => {
    try {
      const response = await api.post("/auth/logout");
      setUser(null);
      setIsAuthenticated(false);
      // Backend returns redirect_url when the user authenticated via an OIDC
      // provider with an end_session_endpoint — navigating there terminates
      // the IdP session (RP-initiated logout per OIDC spec). Otherwise fall
      // back to the local login page.
      window.location.href = response.data?.redirect_url || "/login";
    } catch (error) {
      console.error("Logout error:", error);
      handleLocalLogoutRedirect();
    }
  };

  const logoutLocal = async () => {
    try {
      await api.post("/auth/logout/local");
    } catch (error) {
      console.error("Local logout error:", error);
    } finally {
      handleLocalLogoutRedirect();
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    logoutLocal,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
