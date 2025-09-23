import express from 'express';
import logger from '../config/logger.js';
import { authenticateDownloads } from '../middleware/auth.middleware.js';

const router = express.Router();

// Track connected clients (from DigitalOcean article)
let clients = [];

// SSE endpoint - exactly like DigitalOcean article with minimal middleware
router.get('/events', authenticateDownloads, (req, res) => {
  // Exactly like DigitalOcean article - set headers first
  const headers = {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  };
  res.writeHead(200, headers);

  // Send initial data exactly like article
  const data = `data: ${JSON.stringify([])}\n\n`;
  res.write(data);

  // Client tracking from article
  const clientId = Date.now();
  const newClient = {
    id: clientId,
    response: res,
  };
  clients.push(newClient);

  logger.info('SSE client connected', {
    clientId,
    total: clients.length,
  });

  // Handle disconnection exactly like article
  req.on('close', () => {
    logger.info('SSE client disconnected', {
      clientId,
      total: clients.length - 1,
    });
    clients = clients.filter(client => client.id !== clientId);
  });
});

// Function to broadcast checksum updates (from articles)
export const sendChecksumUpdate = (filePath, checksum, fileStats = null) => {
  logger.info('SSE: Sending checksum update', {
    filePath,
    checksum: `${checksum.substring(0, 8)}...`,
  });

  const eventData = JSON.stringify({
    type: 'checksum_complete',
    filePath,
    checksum,
    size: fileStats?.size || null,
    mtime: fileStats?.mtime || null,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients (from DigitalOcean pattern)
  clients.forEach(client => {
    try {
      // Send custom event (from articles)
      client.response.write(`event: checksum-update\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE message', { error: error.message });
      // Remove failed client
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info('SSE: Event sent successfully');
};

// Function to broadcast file deletion events
export const sendFileDeleted = (filePath, isDirectory = false) => {
  logger.info('SSE: Sending file deletion event', {
    filePath,
    isDirectory,
  });

  const eventData = JSON.stringify({
    type: 'file_deleted',
    filePath,
    isDirectory,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-deleted\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE delete message', { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info('SSE: File deletion event sent successfully');
};

// Function to broadcast folder creation events
export const sendFolderCreated = folderPath => {
  logger.info('SSE: Sending folder creation event', {
    folderPath,
  });

  const eventData = JSON.stringify({
    type: 'folder_created',
    folderPath,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: folder-created\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE folder creation message', { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info('SSE: Folder creation event sent successfully');
};

// Function to broadcast file/folder rename events
export const sendFileRenamed = (oldPath, newPath, isDirectory = false) => {
  logger.info('SSE: Sending file rename event', {
    oldPath,
    newPath,
    isDirectory,
  });

  const eventData = JSON.stringify({
    type: 'file_renamed',
    oldPath,
    newPath,
    isDirectory,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-renamed\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE rename message', { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info('SSE: File rename event sent successfully');
};

export default router;
