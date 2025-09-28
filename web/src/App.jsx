import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./components/auth/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import ProtectedApiRoute from "./components/routing/ProtectedApiRoute";
import ProtectedFileRoute from "./components/routing/ProtectedFileRoute";
import ProtectedSwaggerRoute from "./components/routing/ProtectedSwaggerRoute";

const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/api-keys" element={<ProtectedApiRoute />} />
        <Route path="/api-docs" element={<ProtectedSwaggerRoute />} />
        <Route path="*" element={<ProtectedFileRoute />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
