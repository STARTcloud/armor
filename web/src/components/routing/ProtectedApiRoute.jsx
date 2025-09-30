import ApiKeysPage from "../api/ApiKeysPage";
import ProtectedRoute from "../auth/ProtectedRoute";
import Layout from "../layout/Layout";

const ProtectedApiRoute = () => (
  <ProtectedRoute>
    <Layout>
      <ApiKeysPage />
    </Layout>
  </ProtectedRoute>
);

export default ProtectedApiRoute;
