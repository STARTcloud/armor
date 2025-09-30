/**
 * Formats file size in bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "1.5 MB", "500 KB")
 */
export const formatSize = (bytes) => {
  if (!bytes || bytes === 0) {
    return "-";
  }
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
};

/**
 * Formats date string to localized format
 * @param {string} dateString - ISO date string
 * @param {string} defaultText - Text to show if date is empty
 * @returns {string} Formatted date or default text
 */
export const formatDate = (dateString, defaultText = "Never") => {
  if (!dateString) {
    return defaultText;
  }
  return new Date(dateString).toLocaleString();
};

/**
 * Maps file extension to appropriate Bootstrap icon class
 * @param {string} ext - File extension (lowercase)
 * @returns {string} Bootstrap icon class with color
 */
const getIconByExtension = (ext) => {
  const imageExts = ["jpg", "jpeg", "png", "gif", "svg"];
  const videoExts = ["mp4", "avi", "mov"];
  const audioExts = ["mp3", "wav", "flac"];
  const archiveExts = ["zip", "rar", "7z", "tar", "gz"];
  const textExts = ["txt", "md"];
  const codeExts = ["js", "jsx", "ts", "tsx", "html", "css", "json"];

  if (ext === "pdf") {
    return "bi-file-earmark-pdf text-danger";
  }
  if (imageExts.includes(ext)) {
    return "bi-file-earmark-image text-info";
  }
  if (videoExts.includes(ext)) {
    return "bi-file-earmark-play text-primary";
  }
  if (audioExts.includes(ext)) {
    return "bi-file-earmark-music text-success";
  }
  if (archiveExts.includes(ext)) {
    return "bi-file-earmark-zip text-secondary";
  }
  if (textExts.includes(ext)) {
    return "bi-file-earmark-text text-light";
  }
  if (codeExts.includes(ext)) {
    return "bi-file-earmark-code text-info";
  }
  return "bi-file-earmark text-light";
};

/**
 * Gets appropriate icon for file or directory
 * @param {Object} file - File object with name and isDirectory properties
 * @returns {string} Bootstrap icon class
 */
export const getFileIcon = (file) => {
  if (file.isDirectory) {
    return "bi-folder2 text-light";
  }

  const ext = file.name?.split(".").pop()?.toLowerCase();
  return getIconByExtension(ext);
};

/**
 * Checks if API key has expired
 * @param {string} expiresAt - ISO date string
 * @returns {boolean} True if expired
 */
export const isExpired = (expiresAt) => {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt) < new Date();
};

/**
 * Extracts permission badges from permissions object
 * @param {Object|Array} permissions - Permissions object or array
 * @returns {Array<string>} Array of permission names
 */
export const getPermissionBadges = (permissions) => {
  const badges = [];
  if (Array.isArray(permissions)) {
    return permissions;
  }
  if (permissions.downloads) {
    badges.push("downloads");
  }
  if (permissions.uploads) {
    badges.push("uploads");
  }
  if (permissions.delete) {
    badges.push("delete");
  }
  return badges;
};

/**
 * Sorts API keys by specified field and direction
 * @param {Array} keys - Array of API key objects
 * @param {string} sortField - Field to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @returns {Array} Sorted array of keys
 */
export const sortApiKeys = (keys, sortField, sortDirection) =>
  keys.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "name") {
      aVal = aVal?.toLowerCase() || "";
      bVal = bVal?.toLowerCase() || "";
    } else if (
      sortField === "created_at" ||
      sortField === "expires_at" ||
      sortField === "last_used"
    ) {
      aVal = aVal ? new Date(aVal) : new Date(0);
      bVal = bVal ? new Date(bVal) : new Date(0);
    }

    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

/**
 * Splits text and marks highlighted portions for search results
 * @param {string} text - Text to process
 * @param {string} searchQuery - Search query to highlight
 * @returns {Array<Object>} Array of text parts with highlight info
 */
export const highlightMatch = (text, searchQuery) => {
  if (!searchQuery || !text) {
    return [{ text, isHighlight: false }];
  }

  const regex = new RegExp(
    `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return parts.map((part, index) => ({
    text: part,
    isHighlight: regex.test(part),
    key: regex.test(part) ? `highlight-${part}-${index}` : `text-${index}`,
  }));
};
