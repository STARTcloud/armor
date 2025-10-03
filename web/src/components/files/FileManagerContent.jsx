import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";

import SearchResults from "../search/SearchResults";

import FileTable from "./FileTable";
import StaticContent from "./StaticContent";

const FileManagerContent = ({
  searchResults,
  searchQuery,
  onClearSearch,
  hasStaticContent,
  isGuest,
  currentPath,
  files,
  onDelete,
  onRename,
  selectedFiles,
  onSelectionChange,
  onSelectAll,
  onMoveToParent,
  onMoveToFolder,
  canDelete,
  canUpload,
}) => {
  if (searchResults) {
    return (
      <SearchResults
        results={searchResults}
        query={searchQuery}
        onClear={onClearSearch}
      />
    );
  }

  if (hasStaticContent) {
    return <StaticContent currentPath={currentPath} />;
  }

  if (isGuest) {
    return <Navigate to="/" replace />;
  }

  return (
    <FileTable
      files={files}
      currentPath={currentPath}
      onDelete={onDelete}
      onRename={onRename}
      selectedFiles={selectedFiles}
      onSelectionChange={onSelectionChange}
      onSelectAll={onSelectAll}
      onMoveToParent={onMoveToParent}
      onMoveToFolder={onMoveToFolder}
      canDelete={canDelete}
      canUpload={canUpload}
    />
  );
};

FileManagerContent.propTypes = {
  searchResults: PropTypes.object,
  searchQuery: PropTypes.string,
  onClearSearch: PropTypes.func.isRequired,
  hasStaticContent: PropTypes.bool.isRequired,
  isGuest: PropTypes.bool.isRequired,
  currentPath: PropTypes.string.isRequired,
  files: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  selectedFiles: PropTypes.array.isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  onSelectAll: PropTypes.func.isRequired,
  onMoveToParent: PropTypes.func.isRequired,
  onMoveToFolder: PropTypes.func.isRequired,
  canDelete: PropTypes.bool.isRequired,
  canUpload: PropTypes.bool.isRequired,
};

export default FileManagerContent;
