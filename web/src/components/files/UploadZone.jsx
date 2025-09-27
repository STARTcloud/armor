import PropTypes from "prop-types";
import { useState, useRef } from "react";

import UploadProgress from "./UploadProgress";

const UploadZone = ({ currentPath, onUploadComplete }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const uploadFile = (upload) => {
    const formData = new FormData();
    formData.append("file", upload.file);

    const xhr = new XMLHttpRequest();

    setUploads((prev) =>
      prev.map((u) => (u.id === upload.id ? { ...u, status: "uploading" } : u))
    );

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, progress } : u))
        );
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, status: "completed", progress: 100 }
              : u
          )
        );
        onUploadComplete?.();
      } else {
        let errorMessage = "Upload failed";
        try {
          const response = JSON.parse(xhr.responseText);
          errorMessage = response.message || errorMessage;
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, status: "error", error: errorMessage }
              : u
          )
        );
      }
    });

    xhr.addEventListener("error", () => {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: "error", error: "Network error" }
            : u
        )
      );
    });

    const uploadPath =
      currentPath === "/" ? "/api/files/" : `/api/files${currentPath}`;
    xhr.open("POST", uploadPath);
    xhr.send(formData);
  };

  const handleFiles = (files) => {
    const newUploads = files.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      progress: 0,
      status: "pending", // pending, uploading, completed, error
      error: null,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    newUploads.forEach((upload) => {
      uploadFile(upload);
    });
  };

  const removeUpload = (uploadId) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "completed"));
  };

  const retryUpload = (upload) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === upload.id
          ? { ...u, status: "pending", progress: 0, error: null }
          : u
      )
    );
    uploadFile(upload);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFiles(files);
    }
    e.target.value = "";
  };

  return (
    <div className="mb-4">
      {/* Drop Zone */}
      <div
        className={`upload-drop-zone ${isDragOver ? "upload-drop-zone--over" : ""}`}
        style={{ display: "block" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="upload-drop-zone__prompt">
          <i className="bi bi-cloud-upload display-4" />
          <div>{isDragOver ? "Drop files here" : "Drag & drop files here"}</div>
          <div>
            or <span>click to browse</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="upload-drop-zone__input"
        />
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="upload-list">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="text-light mb-0">
              Upload Progress (
              {uploads.filter((u) => u.status === "completed").length}/
              {uploads.length})
            </h6>
            {uploads.some((u) => u.status === "completed") && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={clearCompleted}
              >
                Clear Completed
              </button>
            )}
          </div>
          <div className="list-group list-group-flush">
            {uploads.map((upload) => (
              <UploadProgress
                key={upload.id}
                upload={upload}
                onRemove={removeUpload}
                onRetry={retryUpload}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

UploadZone.propTypes = {
  currentPath: PropTypes.string.isRequired,
  onUploadComplete: PropTypes.func.isRequired,
};

export default UploadZone;
