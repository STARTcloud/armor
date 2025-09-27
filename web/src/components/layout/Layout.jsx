import Footer from "./Footer";
import Header from "./Header";

const Layout = ({ children }) => (
  <div className="min-vh-100 bg-dark text-light d-flex flex-column">
    <Header />
    <main className="flex-grow-1">{children}</main>
    <Footer />
  </div>
);

export default Layout;
