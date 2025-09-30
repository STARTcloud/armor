import { useEffect, useRef } from "react";

/**
 * Custom hook for Server-Sent Events (SSE) connection
 * Manages real-time file system event notifications
 * @param {Object} callbacks - Event handler callbacks
 * @param {Function} callbacks.onFileAdded - Called when file is added
 * @param {Function} callbacks.onFileDeleted - Called when file is deleted
 * @param {Function} callbacks.onFileRenamed - Called when file is renamed
 * @param {Function} callbacks.onFolderCreated - Called when folder is created
 * @param {Function} callbacks.onChecksumUpdate - Called when checksum is updated
 * @param {Function} callbacks.onChecksumProgress - Called when checksum progress updates
 * @returns {EventSource|null} EventSource instance or null
 */
const useSSE = ({
  onFileAdded,
  onFileDeleted,
  onFileRenamed,
  onFolderCreated,
  onChecksumUpdate,
  onChecksumProgress,
}) => {
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const connectSSE = () => {
      try {
        eventSourceRef.current = new EventSource("/api/events");

        eventSourceRef.current.onopen = () => {
          console.log("SSE connection opened");
        };

        eventSourceRef.current.addEventListener("file-added", (event) => {
          try {
            const data = JSON.parse(event.data);
            onFileAdded?.(data);
          } catch (error) {
            console.error("Error parsing file-added event:", error);
          }
        });

        eventSourceRef.current.addEventListener("file-deleted", (event) => {
          try {
            const data = JSON.parse(event.data);
            onFileDeleted?.(data);
          } catch (error) {
            console.error("Error parsing file-deleted event:", error);
          }
        });

        eventSourceRef.current.addEventListener("file-renamed", (event) => {
          try {
            const data = JSON.parse(event.data);
            onFileRenamed?.(data);
          } catch (error) {
            console.error("Error parsing file-renamed event:", error);
          }
        });

        eventSourceRef.current.addEventListener("folder-created", (event) => {
          try {
            const data = JSON.parse(event.data);
            onFolderCreated?.(data);
          } catch (error) {
            console.error("Error parsing folder-created event:", error);
          }
        });

        eventSourceRef.current.addEventListener("checksum-update", (event) => {
          try {
            const data = JSON.parse(event.data);
            onChecksumUpdate?.(data);
          } catch (error) {
            console.error("Error parsing checksum-update event:", error);
          }
        });

        eventSourceRef.current.addEventListener(
          "checksum-progress",
          (event) => {
            try {
              const data = JSON.parse(event.data);
              onChecksumProgress?.(data);
            } catch (error) {
              console.error("Error parsing checksum-progress event:", error);
            }
          }
        );

        eventSourceRef.current.onerror = (error) => {
          console.error("SSE connection error:", error);

          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              console.log("Attempting to reconnect SSE...");
              connectSSE();
            }
          }, 5000);
        };
      } catch (error) {
        console.error("Failed to establish SSE connection:", error);
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [
    onFileAdded,
    onFileDeleted,
    onFileRenamed,
    onFolderCreated,
    onChecksumUpdate,
    onChecksumProgress,
  ]);

  return eventSourceRef.current;
};

export default useSSE;
