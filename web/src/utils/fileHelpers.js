export const formatSize = (bytes) => {
  if (!bytes || bytes === 0) {
    return "-";
  }
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
};

export const formatDate = (dateString, defaultText = "Never") => {
  if (!dateString) {
    return defaultText;
  }
  return new Date(dateString).toLocaleString();
};

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

export const getFileIcon = (file) => {
  if (file.isDirectory) {
    return "bi-folder2 text-light";
  }

  const ext = file.name?.split(".").pop()?.toLowerCase();
  return getIconByExtension(ext);
};

export const isExpired = (expiresAt) => {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt) < new Date();
};

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
