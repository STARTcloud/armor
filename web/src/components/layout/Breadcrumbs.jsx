import { useLocation, Link } from "react-router-dom";

const Breadcrumbs = () => {
  const location = useLocation();

  const generateBreadcrumbs = (pathname) => {
    const relativePath = pathname.startsWith("/browse")
      ? pathname.substring(7)
      : pathname;

    if (!relativePath || relativePath === "/") {
      return [{ name: "Home", path: "/" }];
    }

    const parts = relativePath.split("/").filter(Boolean);
    const breadcrumbs = [{ name: "Home", path: "/" }];

    let currentPath = "";
    parts.forEach((part) => {
      currentPath += `/${part}`;
      breadcrumbs.push({
        name: decodeURIComponent(part),
        path: `/browse${currentPath}`,
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
                <i className="bi bi-folder-fill me-1" />
                {crumb.name}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-decoration-none"
                style={{ color: "#198754" }}
              >
                <i className="bi bi-house-fill me-1" />
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
