import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import api from "../utils/api";

const useFileLoader = (currentPath) => {
  const { t } = useTranslation(["files"]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasStaticContent, setHasStaticContent] = useState(false);

  const checkStaticContent = useCallback(async () => {
    const staticApiPath =
      currentPath === "/"
        ? "/api/files/static"
        : `/api/files${currentPath}/static`;

    try {
      const staticResponse = await api.get(staticApiPath);
      setHasStaticContent(staticResponse.data.hasStatic);
    } catch {
      console.log("No static content available");
      setHasStaticContent(false);
    }
  }, [currentPath]);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Loading files for currentPath:", currentPath);

      await checkStaticContent();

      const apiPath =
        currentPath === "/" ? "/api/files/" : `/api/files${currentPath}`;
      console.log("Making API call to:", apiPath);

      const response = await api.get(apiPath);
      console.log("API response:", response);
      setFiles(response.data.files || []);
    } catch (err) {
      console.error("Failed to load files:", err);
      console.error("Error details:", err.response?.data, err.response?.status);
      setError(t("files:messages.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [currentPath, t, checkStaticContent]);

  return {
    files,
    loading,
    error,
    hasStaticContent,
    loadFiles,
    setFiles,
    setError,
  };
};

export default useFileLoader;
