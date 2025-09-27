import ProtectedRoute from "../auth/ProtectedRoute";
import FileManager from "../files/FileManager";
import Layout from "../layout/Layout";

const ProtectedFileRoute = () => (
  <ProtectedRoute>
    <Layout>
      <FileManager />
    </Layout>
  </ProtectedRoute>
);

export default ProtectedFileRoute;
