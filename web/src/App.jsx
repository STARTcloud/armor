import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./components/auth/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import ProtectedApiRoute from "./components/routing/ProtectedApiRoute";
import ProtectedFileRoute from "./components/routing/ProtectedFileRoute";

const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedFileRoute path="/" />} />
        <Route path="/browse" element={<ProtectedFileRoute path="/browse" />} />
        <Route
          path="/browse/*"
          element={<ProtectedFileRoute path="/browse/*" />}
        />
        <Route path="/api-keys" element={<ProtectedApiRoute />} />
        <Route path="*" element={<ProtectedFileRoute path="*" />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
