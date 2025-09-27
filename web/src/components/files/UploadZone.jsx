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

    const uploadPath = currentPath === "/" ? "/" : currentPath;
    xhr.open("POST", `/api/files${uploadPath}`);
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
    <div className="card bg-dark border-secondary">
      <div className="card-header bg-dark border-secondary d-flex justify-content-between align-items-center">
        <h6 className="mb-0 text-light">
          <i className="bi bi-cloud-upload me-2" />
          Upload Files
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
      <div className="card-body">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded p-4 text-center mb-3 ${
            isDragOver
              ? "border-success bg-success bg-opacity-10"
              : "border-secondary"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: "pointer" }}
        >
          <i
            className={`bi bi-cloud-upload display-4 mb-3 ${
              isDragOver ? "text-success" : "text-muted"
            }`}
          />
          <h6 className="text-light mb-2">
            {isDragOver ? "Drop files here" : "Drag & drop files here"}
          </h6>
          <p className="text-muted mb-0">
            or <span className="text-primary">click to browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="upload-list">
            <h6 className="text-light mb-3">
              Upload Progress (
              {uploads.filter((u) => u.status === "completed").length}/
              {uploads.length})
            </h6>
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
    </div>
  );
};

export default UploadZone;
