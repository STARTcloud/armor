import { useState, useEffect, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

import api from "../../utils/api";

// Dynamic import for Swagger UI - reduces initial bundle size by 1.38MB!
const SwaggerUI = lazy(() =>
  import("swagger-ui-react").then((module) => {
    // Also dynamically import the CSS
    import("swagger-ui-react/swagger-ui.css");
    return { default: module.default };
  })
);

const SwaggerDocsPage = () => {
  const { t } = useTranslation(["api", "common"]);
  const [swaggerSpec, setSwaggerSpec] = useState(null);
  const [userApiKeys, setUserApiKeys] = useState([]);
  const [swaggerConfig, setSwaggerConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSwaggerData = async () => {
      try {
        const specResponse = await api.get("/api/swagger.json");
        const modifiedSpec = specResponse.data;

        // Update servers with current URL but preserve spec structure for filtering
        const currentUrl = `${window.location.protocol}//${window.location.host}`;
        if (modifiedSpec && modifiedSpec.servers) {
          // Update the first server to current URL, keep others as fallbacks
          modifiedSpec.servers[0] = {
            url: currentUrl,
            description: "- Current",
          };
        }

        setSwaggerSpec(modifiedSpec);

        try {
          const keysResponse = await api.get("/api/user-api-keys");
          if (keysResponse.data.success) {
            setUserApiKeys(keysResponse.data.api_keys || []);
            setSwaggerConfig(keysResponse.data.swagger_config || {});
          }
        } catch (keyError) {
          console.log("API keys not available:", keyError);
        }
      } catch (fetchError) {
        console.error("Error fetching Swagger data:", fetchError);
        setError(t("api:swagger.failedToLoadApiDocumentation"));
      } finally {
        setLoading(false);
      }
    };

    fetchSwaggerData();
  }, [t]);

  // Custom DOM manipulation after SwaggerUI loads
  useEffect(() => {
    if (!swaggerSpec) {
      return;
    }

    // Add API keys section to modal
    const addApiKeysToModal = async (modalContent) => {
      // Fetch fresh data to avoid stale closure values
      let currentApiKeys = [];
      let currentSwaggerConfig = {};

      try {
        const keysResponse = await fetch("/api/user-api-keys", {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        const data = await keysResponse.json();

        if (data.success) {
          currentApiKeys = data.api_keys || [];
          currentSwaggerConfig = data.swagger_config || {};
        }
      } catch (fetchError) {
        console.error("Failed to fetch fresh API keys data:", fetchError);
        // Fall back to state values
        currentApiKeys = userApiKeys;
        currentSwaggerConfig = swaggerConfig;
      }

      const apiKeysDiv = document.createElement("div");
      apiKeysDiv.className = "modal-api-keys";

      const title = document.createElement("h4");
      title.textContent = "🔑 Your API Keys";
      apiKeysDiv.appendChild(title);

      // Show existing API keys based on configuration
      if (currentApiKeys.length > 0) {
        if (currentSwaggerConfig.allow_full_key_retrieval) {
          // Full key retrieval enabled - show keys with fill buttons
          currentApiKeys.forEach((key) => {
            const keyItem = document.createElement("div");
            keyItem.className = "api-key-item";

            const keyHeader = document.createElement("div");
            keyHeader.className = "api-key-header";

            const keyName = document.createElement("strong");
            keyName.textContent = key.name;
            keyName.className = "api-key-name";

            const keyInfo = document.createElement("div");
            keyInfo.className = "api-key-info";
            keyInfo.textContent = `Permissions: ${key.permissions.join(", ")} | Expires: ${new Date(key.expires_at).toLocaleDateString()}`;

            const fillBtn = document.createElement("button");
            fillBtn.textContent = "Fill Auth Field";
            fillBtn.className = "api-key-fill-btn";

            keyHeader.appendChild(keyName);
            keyHeader.appendChild(keyInfo);
            keyHeader.appendChild(fillBtn);
            keyItem.appendChild(keyHeader);

            // Add fill auth field functionality
            fillBtn.addEventListener("click", async () => {
              fillBtn.textContent = "Retrieving...";
              fillBtn.disabled = true;

              try {
                const response = await api.post(
                  `/api/user-api-keys/${key.id}/full`
                );
                if (response.data.success && response.data.full_key) {
                  const authInput =
                    document.querySelector("#auth-bearer-value");
                  if (authInput) {
                    const bearerToken = response.data.full_key;

                    // Use native setter and events for better compatibility
                    const nativeInputValueSetter =
                      Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value"
                      ).set;
                    nativeInputValueSetter.call(authInput, bearerToken);

                    // Trigger events
                    const events = [
                      "input",
                      "change",
                      "keyup",
                      "keydown",
                      "blur",
                      "focus",
                    ];
                    events.forEach((eventType) => {
                      authInput.dispatchEvent(
                        new Event(eventType, { bubbles: true })
                      );
                    });

                    fillBtn.textContent = "Filled!";
                    fillBtn.className = "api-key-fill-btn success";
                    setTimeout(() => {
                      fillBtn.textContent = "Fill Auth Field";
                      fillBtn.className = "api-key-fill-btn";
                      fillBtn.disabled = false;
                    }, 2000);
                  }
                } else {
                  throw new Error("Failed to retrieve key");
                }
              } catch (keyRetrievalError) {
                console.error("Key retrieval error:", keyRetrievalError);
                fillBtn.textContent = "Failed";
                fillBtn.className = "api-key-fill-btn error";
                setTimeout(() => {
                  fillBtn.textContent = "Fill Auth Field";
                  fillBtn.className = "api-key-fill-btn";
                  fillBtn.disabled = false;
                }, 2000);
              }
            });

            apiKeysDiv.appendChild(keyItem);
          });
        } else {
          // Full key retrieval disabled - show keys without fill buttons
          const infoMsg = document.createElement("div");
          infoMsg.className = "no-keys-msg";
          infoMsg.textContent = `You have ${currentApiKeys.length} API key(s), but full key retrieval is disabled. Use temporary key generation below.`;
          apiKeysDiv.appendChild(infoMsg);
        }
      } else if (!currentSwaggerConfig.allow_temp_key_generation) {
        // No API keys and temp key generation disabled
        const noKeysMsg = document.createElement("div");
        noKeysMsg.className = "no-keys-msg";
        noKeysMsg.textContent =
          "No API keys available. Create keys in the API Keys page.";
        apiKeysDiv.appendChild(noKeysMsg);
      }

      // Add temporary key generation option if enabled (always show when enabled, regardless of existing keys)
      if (currentSwaggerConfig.allow_temp_key_generation) {
        // Add separator if there are existing keys
        if (currentApiKeys.length > 0) {
          const separator = document.createElement("hr");
          separator.className = "api-key-separator";
          apiKeysDiv.appendChild(separator);
        }

        const tempKeyDiv = document.createElement("div");
        tempKeyDiv.className = "temp-key-section";

        const tempKeyLabel = document.createElement("div");
        tempKeyLabel.textContent = "Generate Temporary Key for Testing";
        tempKeyLabel.className = "temp-key-label";
        tempKeyDiv.appendChild(tempKeyLabel);

        const tempBtn = document.createElement("button");
        tempBtn.textContent = "Generate Temp Key";
        tempBtn.className = "temp-key-btn";

        tempKeyDiv.appendChild(tempBtn);

        // Add temporary key generation functionality
        tempBtn.addEventListener("click", async () => {
          tempBtn.textContent = "Generating...";
          tempBtn.disabled = true;

          try {
            const response = await api.post("/api/user-api-keys/temp");
            if (response.data.success && response.data.temp_key) {
              const authInput = document.querySelector("#auth-bearer-value");
              if (authInput) {
                const bearerToken = response.data.temp_key.key;

                // Use native setter and events for better compatibility
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  "value"
                ).set;
                nativeInputValueSetter.call(authInput, bearerToken);

                // Trigger events
                const events = [
                  "input",
                  "change",
                  "keyup",
                  "keydown",
                  "blur",
                  "focus",
                ];
                events.forEach((eventType) => {
                  authInput.dispatchEvent(
                    new Event(eventType, { bubbles: true })
                  );
                });

                tempBtn.textContent = "Filled with Temp Key!";
                tempBtn.className = "temp-key-btn success";
                setTimeout(() => {
                  tempBtn.textContent = "Generate Temp Key";
                  tempBtn.className = "temp-key-btn";
                  tempBtn.disabled = false;
                }, 3000);
              }
            } else {
              throw new Error("Failed to generate temp key");
            }
          } catch (tempError) {
            console.error("Temp key generation error:", tempError);
            tempBtn.textContent = "Error";
            tempBtn.className = "temp-key-btn error";
            setTimeout(() => {
              tempBtn.textContent = "Generate Temp Key";
              tempBtn.className = "temp-key-btn";
              tempBtn.disabled = false;
            }, 2000);
          }
        });

        apiKeysDiv.appendChild(tempKeyDiv);
      }

      // Insert at the top of modal content
      modalContent.insertBefore(apiKeysDiv, modalContent.firstChild);
    };

    const addCustomElements = () => {
      const container = document.querySelector(".swagger-ui");
      if (!container) {
        return false;
      }

      // Add custom server input functionality
      const addCustomServerInput = () => {
        // First, fix the scheme-container to behave like other wrapper sections
        const schemeContainer = document.querySelector(
          ".swagger-ui .scheme-container"
        );
        if (schemeContainer) {
          schemeContainer.classList.remove("scheme-container");
          schemeContainer.classList.add("wrapper", "swagger-servers-section");
        }

        const schemesSection = document.querySelector(
          ".swagger-ui .swagger-servers-section .schemes"
        );
        const schemesServerContainer = document.querySelector(
          ".swagger-ui .schemes-server-container"
        );
        const authWrapper = document.querySelector(".swagger-ui .auth-wrapper");

        if (schemesSection && schemesServerContainer && authWrapper) {
          // Avoid duplicate additions
          if (schemesSection.querySelector(".custom-server-input")) {
            return;
          }

          // Add proper classes to schemes section and remove col-12 and wrapper
          schemesSection.classList.remove("col-12", "wrapper");
          schemesSection.classList.add("block", "schemes-flex-container");

          const customServerDiv = document.createElement("div");
          customServerDiv.className = "custom-server-input";

          const customUrlInput = document.createElement("input");
          customUrlInput.type = "text";
          customUrlInput.placeholder =
            "Enter custom server URL (e.g., https://api.example.com:8080)";

          const setButton = document.createElement("button");
          setButton.className = "btn authorize unlocked";
          setButton.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

          customServerDiv.appendChild(customUrlInput);
          customServerDiv.appendChild(setButton);

          // Add functionality to set button
          setButton.addEventListener("click", () => {
            const customUrl = customUrlInput.value.trim();
            if (customUrl) {
              const serverSelect = document.querySelector("#servers");
              if (serverSelect) {
                // Add the custom URL as a new option
                const customOption = document.createElement("option");
                customOption.value = customUrl;
                customOption.textContent = `${customUrl} - Custom`;
                serverSelect.appendChild(customOption);
                serverSelect.value = customUrl;

                // Visual feedback with checkmark animation
                const originalIcon = setButton.innerHTML;
                setButton.innerHTML =
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path></svg>';
                setButton.className = "btn authorize unlocked success";
                setTimeout(() => {
                  setButton.innerHTML = originalIcon;
                  setButton.className = "btn authorize unlocked";
                }, 1500);
              }
            }
          });

          // Allow Enter key to set server
          customUrlInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              setButton.click();
            }
          });

          // Insert the custom server div into the schemes section
          schemesSection.insertBefore(customServerDiv, authWrapper);
        }
      };

      // Add API keys functionality to authorize modal
      const observeModals = () => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (
                node.nodeType === 1 &&
                node.querySelector &&
                node.querySelector(".modal-ux") &&
                !node.hasAttribute("data-processed")
              ) {
                // Mark this modal as processed to prevent duplicates
                node.setAttribute("data-processed", "true");

                // Add click-outside-to-close functionality
                const backdrop = node.querySelector(".backdrop-ux");
                if (backdrop) {
                  backdrop.addEventListener("click", () => {
                    const closeBtn = node.querySelector(".close-modal");
                    if (closeBtn) {
                      closeBtn.click();
                    }
                  });
                }

                // Modal opened, add API keys section
                setTimeout(() => {
                  const modalContent = node.querySelector(".modal-ux-content");
                  if (
                    modalContent &&
                    !modalContent.querySelector(".modal-api-keys")
                  ) {
                    addApiKeysToModal(modalContent);
                  }
                }, 100);
              }
            });
          });
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      };

      addCustomServerInput();
      observeModals();
      return true;
    };

    // Add custom elements after SwaggerUI loads
    setTimeout(() => {
      addCustomElements();
    }, 500);
  }, [swaggerSpec, userApiKeys, swaggerConfig]);

  const loadingSpinner = (
    <div className="d-flex justify-content-center align-items-center swagger-loading-spinner">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">
          {t("api:swagger.loadingSwaggerUI")}
        </span>
      </div>
    </div>
  );

  const swaggerUIConfig = {
    spec: swaggerSpec,
    deepLinking: true,
    displayOperationId: false,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    defaultModelRendering: "example",
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    validatorUrl: null,
    requestInterceptor: (request) => {
      if (request.url.startsWith("/")) {
        const currentUrl = `${window.location.protocol}//${window.location.host}`;
        request.url = currentUrl + request.url;
      }

      if (userApiKeys.length > 0 && userApiKeys[0].key) {
        request.headers["X-API-Key"] = userApiKeys[0].key;
      }

      return request;
    },
    responseInterceptor: (response) => response,
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center swagger-loading-spinner">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">
            {t("api:swagger.loadingApiDocumentation")}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="swagger-error-container">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">
            {t("api:swagger.errorLoadingApiDocumentation")}
          </h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="swagger-container">
      <Suspense fallback={loadingSpinner}>
        <SwaggerUI {...swaggerUIConfig} />
      </Suspense>
    </div>
  );
};

export default SwaggerDocsPage;
