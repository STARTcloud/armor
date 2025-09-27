export const API_ENDPOINTS = {
  AUTH: {
    STATUS: "/auth/status",
    LOGIN: "/auth/login/basic",
    LOGOUT: "/auth/logout",
    METHODS: "/auth/methods",
  },
  FILES: {
    SEARCH_ROOT: "/search",
    SEARCH_PATH: "/search",
  },
  KEYS: {
    BASE: "/api/keys",
  },
  SSE: {
    EVENTS: "/events",
  },
};

export const FILE_ICONS = {
  DIRECTORY: "bi-folder-fill text-warning",
  PDF: "bi-file-earmark-pdf text-danger",
  IMAGE: "bi-file-earmark-image text-info",
  VIDEO: "bi-file-earmark-play text-primary",
  AUDIO: "bi-file-earmark-music text-success",
  ARCHIVE: "bi-file-earmark-zip text-secondary",
  TEXT: "bi-file-earmark-text text-light",
  CODE: "bi-file-earmark-code text-info",
  DEFAULT: "bi-file-earmark text-light",
};

export const FILE_EXTENSIONS = {
  IMAGE: ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"],
  VIDEO: ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"],
  AUDIO: ["mp3", "wav", "flac", "aac", "ogg", "wma"],
  ARCHIVE: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  TEXT: ["txt", "md", "rtf"],
  CODE: [
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "scss",
    "json",
    "xml",
    "yaml",
    "yml",
    "py",
    "java",
    "cpp",
    "c",
    "h",
  ],
};

export const UPLOAD_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  COMPLETED: "completed",
  ERROR: "error",
};

export const SSE_EVENTS = {
  FILE_ADDED: "file-added",
  FILE_DELETED: "file-deleted",
  FILE_RENAMED: "file-renamed",
  CHECKSUM_UPDATE: "checksum-update",
};

export const PERMISSIONS = {
  DOWNLOADS: "downloads",
  UPLOADS: "uploads",
  DELETE: "delete",
};
