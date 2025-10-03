import { Helmet } from "@dr.pogodin/react-helmet";
import PropTypes from "prop-types";

import Footer from "./Footer";
import Header from "./Header";

const Layout = ({ children }) => (
  <div className="min-vh-100 bg-dark text-light d-flex flex-column">
    <Helmet>
      <title>Armor</title>
      <titleTemplate>%s - Armor</titleTemplate>
    </Helmet>
    <div className="main-content">
      <div className="container layout-container">
        <Header />
        <main className="flex-grow-1">{children}</main>
      </div>
    </div>
    <Footer />
  </div>
);

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
