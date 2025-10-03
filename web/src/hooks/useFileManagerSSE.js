import { useCallback } from "react";

import useSSE from "./useSSE";

const useFileManagerSSE = (
  currentPath,
  loadFiles,
  setFiles,
  setChecksumProgress
) => {
  const handleFileDeleted = useCallback(
    (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      const fileDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (fileDirectory === currentPath || webPath.startsWith(currentPath)) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleFileRenamed = useCallback(
    (data) => {
      const oldWebPath = data.oldPath.replace("/local/www", "") || "/";
      const newWebPath = data.newPath.replace("/local/www", "") || "/";
      const oldDirectory =
        oldWebPath.substring(0, oldWebPath.lastIndexOf("/")) || "/";
      const newDirectory =
        newWebPath.substring(0, newWebPath.lastIndexOf("/")) || "/";
      if (oldDirectory === currentPath || newDirectory === currentPath) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleFolderCreated = useCallback(
    (data) => {
      const webPath = data.folderPath.replace("/local/www", "") || "/";
      const folderDirectory =
        webPath.substring(0, webPath.lastIndexOf("/")) || "/";
      if (folderDirectory === currentPath) {
        loadFiles();
      }
    },
    [currentPath, loadFiles]
  );

  const handleChecksumUpdate = useCallback(
    (data) => {
      const webPath = data.filePath.replace("/local/www", "") || "/";
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.path === webPath ? { ...file, checksum: data.checksum } : file
        )
      );
    },
    [setFiles]
  );

  const handleChecksumProgress = useCallback(
    (data) => {
      setChecksumProgress(data);
    },
    [setChecksumProgress]
  );

  const handleFileAdded = useCallback(() => {
    console.log(
      "SSE onFileAdded - ignoring during scanning to prevent page reloads"
    );
  }, []);

  useSSE({
    onFileAdded: handleFileAdded,
    onFileDeleted: handleFileDeleted,
    onFileRenamed: handleFileRenamed,
    onFolderCreated: handleFolderCreated,
    onChecksumUpdate: handleChecksumUpdate,
    onChecksumProgress: handleChecksumProgress,
  });
};

export default useFileManagerSSE;
