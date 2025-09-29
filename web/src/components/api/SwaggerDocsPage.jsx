import { useState, useEffect } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

import api from "../../utils/api";

const SwaggerDocsPage = () => {
  const [swaggerSpec, setSwaggerSpec] = useState(null);
  const [userApiKeys, setUserApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSwaggerData = async () => {
      try {
        const specResponse = await api.get("/api/swagger.json");
        setSwaggerSpec(specResponse.data);

        try {
          const keysResponse = await api.get("/api/user-api-keys");
          if (keysResponse.data.success) {
            setUserApiKeys(keysResponse.data.api_keys || []);
          }
        } catch (keyError) {
          console.log("API keys not available:", keyError);
        }
      } catch (err) {
        console.error("Error fetching Swagger data:", err);
        setError("Failed to load API documentation");
      } finally {
        setLoading(false);
      }
    };

    fetchSwaggerData();
  }, []);

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "400px", backgroundColor: "#1a1d20" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading API documentation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ backgroundColor: "#1a1d20", color: "#fff", padding: "20px" }}
      >
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Error Loading API Documentation</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="swagger-container">

      <SwaggerUI
        spec={swaggerSpec}
        deepLinking
        displayOperationId={false}
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={1}
        defaultModelRendering="example"
        displayRequestDuration
        docExpansion="list"
        filter
        showExtensions
        showCommonExtensions
        tryItOutEnabled
        validatorUrl={null}
        requestInterceptor={(request) => {
          if (request.url.startsWith("/")) {
            const currentUrl = `${window.location.protocol}//${window.location.host}`;
            request.url = currentUrl + request.url;
          }

          if (userApiKeys.length > 0 && userApiKeys[0].key) {
            request.headers["X-API-Key"] = userApiKeys[0].key;
          }

          console.log("Request interceptor:", request);
          return request;
        }}
        responseInterceptor={(response) => {
          console.log("Response interceptor:", response);
          return response;
        }}
      />
    </div>
  );
};

export default SwaggerDocsPage;
