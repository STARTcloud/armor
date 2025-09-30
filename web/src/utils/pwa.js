/**
 * PWA Utilities for Armor
 * Handles service worker registration, install prompts, and offline functionality
 */

// Internal helper functions (defined first to avoid hoisting issues)
const showUpdateAvailableNotification = () => {
  // You can integrate this with your existing notification system
  console.log("[PWA] Update available - consider showing user notification");
};

const showOfflineReadyNotification = () => {
  console.log("[PWA] App ready for offline use");
};

// IndexedDB helpers (defined first)
const openIndexedDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("ArmorUploadQueue", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("uploads")) {
        const store = db.createObjectStore("uploads", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });

const addToUploadQueue = (db, uploadData) =>
  new Promise((resolve, reject) => {
    const transaction = db.transaction(["uploads"], "readwrite");
    const store = transaction.objectStore("uploads");
    const request = store.add(uploadData);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const getUploadQueueCount = (db) =>
  new Promise((resolve, reject) => {
    const transaction = db.transaction(["uploads"], "readonly");
    const store = transaction.objectStore("uploads");
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

/**
 * Register the service worker for PWA functionality
 * @returns {Promise<ServiceWorkerRegistration|null>} Service worker registration or null if not supported
 */
export const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log(
        "[PWA] Service Worker registered successfully:",
        registration.scope
      );

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("[PWA] New service worker found, installing...");

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              console.log(
                "[PWA] New content available, prompting user to reload"
              );
              showUpdateAvailableNotification();
            } else {
              console.log("[PWA] Content cached for offline use");
              showOfflineReadyNotification();
            }
          }
        });
      });

      return registration;
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error);
      return null;
    }
  } else {
    console.log("[PWA] Service Worker not supported in this browser");
    return null;
  }
};

/**
 * Check if the app is running in standalone mode (installed as PWA)
 * @returns {boolean} True if running as installed PWA
 */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

/**
 * Check if the app can be installed (PWA install prompt available)
 * @returns {boolean} True if install prompt is available
 */
export const canInstall = () => window.deferredPrompt !== null;

/**
 * Show install prompt for PWA
 * @returns {Promise<boolean>} True if user accepted install
 */
export const showInstallPrompt = async () => {
  if (!window.deferredPrompt) {
    console.log("[PWA] Install prompt not available");
    return false;
  }

  try {
    // Show the install prompt
    window.deferredPrompt.prompt();

    // Wait for user choice
    const choiceResult = await window.deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      console.log("[PWA] User accepted install prompt");
      window.deferredPrompt = null;
      return true;
    }
    console.log("[PWA] User dismissed install prompt");
    return false;
  } catch (error) {
    console.error("[PWA] Install prompt failed:", error);
    return false;
  }
};

/**
 * Check if the browser is online
 * @returns {boolean} True if online
 */
export const isOnline = () => navigator.onLine;

/**
 * Add listeners for online/offline status changes
 * @param {Function} onOnline - Callback when going online
 * @param {Function} onOffline - Callback when going offline
 */
export const addOnlineOfflineListeners = (onOnline, onOffline) => {
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
};

/**
 * Queue an upload for background sync when offline
 * @param {File} file - File to upload
 * @param {string} url - Upload URL
 * @param {Object} headers - Request headers
 */
export const queueUploadForSync = async (file, url, headers = {}) => {
  try {
    const db = await openIndexedDB();
    const uploadData = {
      file,
      url,
      headers,
      fileName: file.name,
      timestamp: Date.now(),
    };

    await addToUploadQueue(db, uploadData);

    // Register for background sync
    if (
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype
    ) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register("upload-sync");
      console.log("[PWA] Upload queued for background sync:", file.name);
    }
  } catch (error) {
    console.error("[PWA] Failed to queue upload:", error);
    throw error;
  }
};

/**
 * Get the number of queued uploads
 * @returns {Promise<number>} Number of uploads in queue
 */
export const getQueuedUploadCount = async () => {
  try {
    const db = await openIndexedDB();
    return getUploadQueueCount(db);
  } catch (error) {
    console.error("[PWA] Failed to get queue count:", error);
    return 0;
  }
};
