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
    <form onSubmit={handleSubmit} className="d-flex">
      <div className="input-group">
        <span className="input-group-text bg-dark border-secondary text-light">
          <i className="bi bi-search" />
        </span>
        <input
          type="text"
          className="form-control bg-dark text-light border-secondary"
          placeholder="Search files and checksums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
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
        <button
          type="submit"
          className="btn btn-outline-primary"
          disabled={!query.trim()}
        >
          Search
        </button>
      </div>
    </form>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
};

export default SearchBar;
