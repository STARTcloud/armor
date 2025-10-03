import { useLocation, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";
import FileManager from "../files/FileManager";
import Layout from "../layout/Layout";
import LandingPage from "../pages/LandingPage";

const ProtectedFileRoute = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const getCurrentPath = () => {
    const { pathname } = location;
    return pathname === "/" ? "/" : pathname;
  };

  const currentPath = getCurrentPath();
  const viewIndex = searchParams.get("view") === "index";
  const isRoot = currentPath === "/";
  const isGuest = user?.permissions?.includes("restricted");
  
  // Guest users should always see the landing page, never the file manager
  const showLandingPage = isGuest || (isRoot && !viewIndex);

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
