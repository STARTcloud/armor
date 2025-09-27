const Footer = () => (
  <footer className="py-4 border-top border-secondary">
    <div className="container text-center">
      <div className="d-flex align-items-center justify-content-center">
        <span className="text-light me-2">Powered by</span>
        <a
          href="https://startcloud.com"
          target="_blank"
          className="text-decoration-none d-flex align-items-center"
          rel="noreferrer"
        >
          <img
            src="https://startcloud.com/assets/images/logos/startcloud-logo40.png"
            alt="STARTcloud"
            height="20"
            className="me-2"
          />
          <span className="text-light">STARTcloud</span>
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
