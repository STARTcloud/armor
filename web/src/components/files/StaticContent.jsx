import DOMPurify from "dompurify";
import parse from "html-react-parser";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "../../utils/api";

const StaticContent = ({ currentPath }) => {
  const { t } = useTranslation(["files", "common"]);
  const [staticHtml, setStaticHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStaticContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiPath =
          currentPath === "/"
            ? "/api/files/static"
            : `/api/files${currentPath}/static`;

        const response = await api.get(apiPath);

        if (response.data.hasStatic) {
          setStaticHtml(response.data.content);
        } else {
          setStaticHtml(null);
        }
      } catch (err) {
        console.error("Failed to load static content:", err);
        setError(t("files:messages.failedToLoad"));
      } finally {
        setLoading(false);
      }
    };

    loadStaticContent();
  }, [currentPath, t]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t("common:status.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!staticHtml) {
    return null;
  }

  const sanitizedHtml = DOMPurify.sanitize(staticHtml);
  const parsedContent = parse(sanitizedHtml);

  return <div className="static-content-container">{parsedContent}</div>;
};

StaticContent.propTypes = {
  currentPath: PropTypes.string.isRequired,
};

export default StaticContent;
