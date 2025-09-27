import { useLocation, useSearchParams } from "react-router-dom";

import ProtectedRoute from "../auth/ProtectedRoute";
import FileManager from "../files/FileManager";
import Layout from "../layout/Layout";
import LandingPage from "../pages/LandingPage";

const ProtectedFileRoute = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const getCurrentPath = () => {
    const { pathname } = location;
    return pathname === "/" ? "/" : pathname;
  };

  const currentPath = getCurrentPath();
  const viewIndex = searchParams.get("view") === "index";
  const isRoot = currentPath === "/";
  const showLandingPage = isRoot && !viewIndex;

  return (
    <ProtectedRoute>
      {showLandingPage ? (
        <LandingPage />
      ) : (
        <Layout>
          <FileManager />
        </Layout>
      )}
    </ProtectedRoute>
  );
};

export default ProtectedFileRoute;
