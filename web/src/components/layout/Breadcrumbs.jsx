import { useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../../utils/api";

const Breadcrumbs = () => {
  const location = useLocation();
  const [primaryColor, setPrimaryColor] = useState("#198754");

  useEffect(() => {
    const fetchUIConfig = async () => {
      try {
        const response = await api.get("/auth/methods");
        if (response.data.success && response.data.ui?.login_primary_color) {
          setPrimaryColor(response.data.ui.login_primary_color);
        }
      } catch (error) {
        console.error("Failed to fetch UI config:", error);
      }
    };

    fetchUIConfig();
  }, []);

  const generateBreadcrumbs = (pathname) => {
    if (!pathname || pathname === "/") {
      return [{ name: "Armor", path: "/" }];
    }

    const parts = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ name: "Armor", path: "/" }];

    let currentPath = "";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      breadcrumbs.push({
        name: decodeURIComponent(part),
        path: currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs(location.pathname);

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb mb-0">
        {breadcrumbs.map((crumb, index) => (
          <li
            key={crumb.path}
            className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? "active" : ""}`}
          >
            {index === breadcrumbs.length - 1 ? (
              <span className="text-light">
                {index === 0 ? (
                  <i 
                    className="bi bi-shield-check me-1" 
                    style={{ color: primaryColor }}
                  />
                ) : (
                  <i className="bi bi-folder2 me-1 text-light" />
                )}
                {crumb.name}
              </span>
            ) : (
              <Link to={crumb.path} className="text-decoration-none text-light">
                {index === 0 ? (
                  <i 
                    className="bi bi-shield-check me-1" 
                    style={{ color: primaryColor }}
                  />
                ) : (
                  <i className="bi bi-folder2 me-1 text-light" />
                )}
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
