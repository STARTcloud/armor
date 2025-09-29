import express from 'express';
import { sseLogger as logger } from '../config/logger.js';
import { authenticateDownloads } from '../middleware/auth.middleware.js';

const router = express.Router();

// Track connected clients (from DigitalOcean article)
let clients = [];

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Server-Sent Events stream
 *     description: Establishes a Server-Sent Events connection for real-time updates about file operations (checksum updates, file deletions, additions, renames, folder creation)
 *     tags: [Events]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     responses:
 *       200:
 *         description: SSE connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream with real-time file operation updates
 *               example: |
 *                 event: checksum-update
 *                 data: {"type":"checksum_complete","filePath":"/uploads/file.txt","checksum":"abc123...","timestamp":"2025-09-29T14:30:00.000Z"}
 *
 *                 event: file-deleted
 *                 data: {"type":"file_deleted","filePath":"/uploads/old.txt","isDirectory":false,"timestamp":"2025-09-29T14:31:00.000Z"}
 *
 *                 event: file-added
 *                 data: {"type":"file_added","filePath":"/uploads/new.txt","size":1024,"timestamp":"2025-09-29T14:32:00.000Z"}
 *
 *                 event: file-renamed
 *                 data: {"type":"file_renamed","oldPath":"/uploads/old.txt","newPath":"/uploads/new.txt","isDirectory":false,"timestamp":"2025-09-29T14:33:00.000Z"}
 *
 *                 event: folder-created
 *                 data: {"type":"folder_created","folderPath":"/uploads/new-folder","timestamp":"2025-09-29T14:34:00.000Z"}
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: text/event-stream
 *           Connection:
 *             schema:
 *               type: string
 *               example: keep-alive
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-cache
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', authenticateDownloads, (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  };
  res.writeHead(200, headers);

  const data = `data: ${JSON.stringify([])}\n\n`;
  res.write(data);

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

  req.on('close', () => {
    logger.info('SSE client disconnected', {
      clientId,
      total: clients.length - 1,
    });
    clients = clients.filter(client => client.id !== clientId);
  });
});

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

// Function to broadcast file addition events
export const sendFileAdded = (filePath, fileStats = null) => {
  logger.info('SSE: Sending file addition event', {
    filePath,
  });

  const eventData = JSON.stringify({
    type: 'file_added',
    filePath,
    size: fileStats?.size || null,
    mtime: fileStats?.mtime || null,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-added\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE file addition message', { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info('SSE: File addition event sent successfully');
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
