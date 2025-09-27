import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";

import ProtectedRoute from "../auth/ProtectedRoute";
import FileManager from "../files/FileManager";
import Layout from "../layout/Layout";

const ProtectedFileRoute = ({ path }) => {
  return (
    <ProtectedRoute>
      <Layout>
        <FileManager />
      </Layout>
    </ProtectedRoute>
  );
};

ProtectedFileRoute.propTypes = {
  path: PropTypes.string.isRequired,
};

export default ProtectedFileRoute;
