import PropTypes from "prop-types";

import Footer from "./Footer";
import Header from "./Header";

const Layout = ({ children }) => (
  <div className="min-vh-100 bg-dark text-light d-flex flex-column">
    <Header />
    <main className="flex-grow-1 container-fluid px-4">{children}</main>
    <Footer />
  </div>
);

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
