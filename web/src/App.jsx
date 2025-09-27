import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ApiKeysPage from "./components/api/ApiKeysPage";
import { AuthProvider } from "./components/auth/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import FileManager from "./components/files/FileManager";
import Layout from "./components/layout/Layout";

const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Navigate to="/browse/" replace />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <Layout>
                <FileManager />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/browse/*"
          element={
            <ProtectedRoute>
              <Layout>
                <FileManager />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-keys"
          element={
            <ProtectedRoute>
              <Layout>
                <ApiKeysPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Layout>
                <Navigate to="/browse/" replace />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
