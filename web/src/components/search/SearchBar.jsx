import PropTypes from "prop-types";
import { useState } from "react";

const SearchBar = ({ onSearch, onClear, value }) => {
  const [query, setQuery] = useState(value || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onSearch(newQuery); // Trigger search on every keystroke
  };

  const handleClear = () => {
    setQuery("");
    onClear();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  const handleInputClear = () => {
    setQuery("");
    onClear();
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="input-group" style={{ width: "300px" }}>
        <input
          type="text"
          className="form-control bg-dark text-light border-secondary"
          placeholder="Search API keys..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="btn btn-outline-secondary position-absolute"
            style={{
              right: "45px",
              zIndex: 10,
              border: "none",
              background: "transparent",
            }}
            onClick={handleInputClear}
            title="Clear input and search"
          >
            <i className="bi bi-x" />
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-outline-light"
          onClick={handleSubmit}
          title="Search"
        >
          <i className="bi bi-search" />
        </button>
      </div>
    </div>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
};

export default SearchBar;
