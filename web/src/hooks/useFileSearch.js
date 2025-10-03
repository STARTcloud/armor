import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import api from "../utils/api";

const useFileSearch = (currentPath, onError) => {
  const { t } = useTranslation(["files"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const handleSearch = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSearchResults(null);
        setSearchQuery("");
        return;
      }

      try {
        setSearchQuery(query);
        const searchEndpoint =
          currentPath === "/"
            ? "/api/files/search"
            : `/api/files${currentPath}/search`;
        const response = await api.post(searchEndpoint, {
          query,
          page: 1,
          limit: 100,
        });
        setSearchResults(response.data);
      } catch (err) {
        console.error("Search failed:", err);
        onError(t("files:search.searchError"));
      }
    },
    [currentPath, t, onError]
  );

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    searchResults,
    handleSearch,
    clearSearch,
  };
};

export default useFileSearch;
