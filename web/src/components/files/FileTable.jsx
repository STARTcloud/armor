import PropTypes from "prop-types";
import { useState } from "react";

import FileRow from "./FileRow";

const FileTable = ({ files, currentPath, onDelete, onRename }) => {
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "size") {
      aValue = a.isDirectory ? -1 : a.size || 0;
      bValue = b.isDirectory ? -1 : b.size || 0;
    } else if (sortField === "modified") {
      aValue = new Date(a.modified || 0);
      bValue = new Date(b.modified || 0);
    } else if (sortField === "name") {
      if (a.isDirectory && !b.isDirectory) {
        return -1;
      }
      if (!a.isDirectory && b.isDirectory) {
        return 1;
      }
      aValue = (a.name || "").toLowerCase();
      bValue = (b.name || "").toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return "bi-arrow-down-up";
    }
    return sortDirection === "asc" ? "bi-arrow-up" : "bi-arrow-down";
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) {
      return "-";
    }
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "-";
    }
    return new Date(dateString).toLocaleString();
  };

  if (!files || files.length === 0) {
    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body text-center py-5">
          <i className="bi bi-folder2-open display-4 text-muted mb-3" />
          <h5 className="text-muted">This directory is empty</h5>
          <p className="text-muted">
            Upload files or create folders to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-dark border-secondary">
      <div className="card-header bg-dark border-secondary">
        <h5 className="mb-0 text-light">
          <i className="bi bi-folder-fill me-2" />
          Directory Contents ({files.length} items)
        </h5>
      </div>
      <div className="table-responsive">
        <table className="table table-dark table-hover mb-0">
          <thead>
            <tr>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("name")}
              >
                Name <i className={`bi ${getSortIcon("name")} ms-1`} />
              </th>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("size")}
              >
                Size <i className={`bi ${getSortIcon("size")} ms-1`} />
              </th>
              <th
                scope="col"
                className="cursor-pointer user-select-none"
                onClick={() => handleSort("modified")}
              >
                Modified <i className={`bi ${getSortIcon("modified")} ms-1`} />
              </th>
              <th scope="col">Checksum</th>
              <th scope="col" width="120">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file, index) => (
              <FileRow
                key={file.path || index}
                file={file}
                currentPath={currentPath}
                onDelete={onDelete}
                onRename={onRename}
                formatSize={formatSize}
                formatDate={formatDate}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

FileTable.propTypes = {
  files: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentPath: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
};

export default FileTable;
