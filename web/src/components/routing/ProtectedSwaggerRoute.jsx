import SwaggerDocsPage from "../api/SwaggerDocsPage";
import ProtectedRoute from "../auth/ProtectedRoute";
import Layout from "../layout/Layout";

const ProtectedSwaggerRoute = () => (
  <ProtectedRoute>
    <Layout>
      <SwaggerDocsPage />
    </Layout>
  </ProtectedRoute>
);

export default ProtectedSwaggerRoute;
