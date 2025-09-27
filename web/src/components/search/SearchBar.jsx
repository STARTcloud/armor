import PropTypes from "prop-types";
import { useState } from "react";

const SearchBar = ({ onSearch, onClear, value }) => {
  const [query, setQuery] = useState(value || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
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

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="input-group" style={{ width: "300px" }}>
        <input
          type="text"
          className="form-control bg-dark text-light border-secondary"
          placeholder="Search files or Checksums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn btn-outline-light"
          onClick={handleSubmit}
          title="Search"
        >
          <i className="bi bi-search" />
        </button>
      </div>
      {query && (
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleClear}
          title="Clear search"
        >
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
};

export default SearchBar;
