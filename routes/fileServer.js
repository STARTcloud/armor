import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { join, basename, extname, resolve } from 'path';
import { Op } from 'sequelize';
import auth from 'basic-auth';
import escapeHtml from 'escape-html';
import { SERVED_DIR, getSecurePath, isLocalUrl } from '../config/paths.js';
import {
  authenticateDownloads,
  authenticateUploads,
  authenticateDelete,
} from '../middleware/auth.middleware.js';
import { isAllowedDirectory, getStaticContent } from '../utils/auth.js';
import { getDirectoryItems } from '../utils/fileUtils.js';
import { logAccess, logger, accessLogger, databaseLogger } from '../config/logger.js';
import configLoader from '../config/configLoader.js';
import { getFileModel } from '../models/File.js';
import { withDatabaseRetry } from '../config/database.js';
import { sendFileDeleted, sendFileRenamed, sendFolderCreated } from './sse.js';

// Helper function to create landing config

// Helper function to handle JSON directory response
const handleJsonDirectoryResponse = async (req, res, fullPath, relativePath) => {
  const itemsInfo = await getDirectoryItems(fullPath, req.fileWatcher);
  logAccess(req, 'LIST_DIRECTORY', `size: ${itemsInfo.length} items`);

  const files = itemsInfo.map(item => ({
    name: item.name,
    path: join(relativePath, item.name).replace(/\\/g, '/'),
    size: item.size,
    mtime: item.mtime.toISOString(),
    checksum: item.checksum || 'Pending',
    isDirectory: item.isDirectory,
  }));

  return res.json({
    success: true,
    path: relativePath,
    files,
    total: files.length,
  });
};

// Helper function to check if landing page should be shown
const shouldShowLandingPage = (isRoot, serverConfig, isAdmin, viewIndex, query) =>
  isRoot && !serverConfig.show_root_index && !(isAdmin && viewIndex) && !query.sort && !query.order;

// Helper function to handle landing page response
const handleLandingPageResponse = (req, res) => {
  accessLogger.info('Redirecting to React app for root access');
  logAccess(req, 'LANDING_PAGE', 'redirecting to React app');
  return res.redirect('/');
};

// Helper function to handle directory listing
const handleDirectoryListing = async (req, res, fullPath, requestPath) => {
  const uploadCredentials = auth(req);
  const isAllowed = isAllowedDirectory(fullPath, SERVED_DIR);

  if (!isAllowed) {
    logAccess(req, 'ACCESS_DENIED', 'directory not in allowed list');
    return res.redirect('/');
  }

  const serverConfig = configLoader.getServerConfig();
  const relativePath = fullPath.replace(SERVED_DIR, '').replace(/\\/g, '/');
  const isRoot = fullPath === SERVED_DIR || fullPath === `${SERVED_DIR}/`;
  const isAdmin =
    req.oidcUser?.permissions?.includes('uploads') || req.isAuthenticated === 'uploads';
  const viewIndex = req.query.view === 'index';

  accessLogger.info('Root page check', {
    fullPath,
    SERVED_DIR,
    isRoot,
    showRootIndex: serverConfig.show_root_index,
    isAdmin,
    viewIndex,
    willShowLandingPage: shouldShowLandingPage(isRoot, serverConfig, isAdmin, viewIndex, req.query),
  });

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return handleJsonDirectoryResponse(req, res, fullPath, relativePath);
  }

  const staticContent = await getStaticContent(fullPath);
  if (staticContent) {
    const baseUrl = requestPath.endsWith('/') ? requestPath : `${requestPath}/`;
    const escapedBaseUrl = escapeHtml(baseUrl);
    const contentWithBase = staticContent.replace(
      '</head>',
      `<base href="${escapedBaseUrl}"></head>`
    );
    logAccess(req, 'STATIC_PAGE', 'serving static index.html');
    return res.send(contentWithBase);
  }

  if (shouldShowLandingPage(isRoot, serverConfig, isAdmin, viewIndex, req.query)) {
    return handleLandingPageResponse(req, res, uploadCredentials);
  }

  // Serve React app for directory listing
  const indexPath = join(process.cwd(), 'web', 'dist', 'index.html');
  return res.sendFile(indexPath);
};

/**
 * @swagger
 * tags:
 *   - name: Files
 *     description: File and directory management endpoints
 *   - name: Search
 *     description: File search endpoints
 */

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    logger.debug('Multer destination', { file: file.originalname, targetDir });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    const fullPath = join(targetDir, sanitizedName);

    if (req.fileWatcher) {
      req.fileWatcher.markUploadStart(fullPath);
    }

    cb(null, sanitizedName);
  },
});

const upload = multer({ storage });

/**
 * @swagger
 * /{path}:
 *   get:
 *     summary: Download file or list directory contents
 *     description: Download a file or get directory listing. Returns JSON when Accept header includes application/json, otherwise returns HTML or file content.
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File or directory path
 *         example: /uploads/document.pdf
 *       - in: header
 *         name: Accept
 *         schema:
 *           type: string
 *         description: Set to 'application/json' for JSON directory listing
 *         example: application/json
 *     responses:
 *       200:
 *         description: Success - file content, HTML page, or JSON directory listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectoryListing'
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML directory listing page
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *               description: File content
 *       301:
 *         description: Redirect to add trailing slash for directories
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or directory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('*splat', authenticateDownloads, async (req, res) => {
  const requestPath = Array.isArray(req.params.splat)
    ? req.params.splat.join('/')
    : req.params.splat || '';

  try {
    const fullPath = getSecurePath(requestPath);

    try {
      await fs.access(fullPath);
    } catch {
      logAccess(req, 'NOT_FOUND', fullPath);
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(404).json({ error: 'File not found' });
      }
      const indexPath = join(process.cwd(), 'web', 'dist', 'index.html');
      return res.sendFile(indexPath);
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      if (!requestPath.endsWith('/')) {
        const redirectPath = req.originalUrl.endsWith('/')
          ? req.originalUrl
          : `${req.originalUrl}/`;

        if (!isLocalUrl(redirectPath)) {
          logger.warn('Rejected potentially unsafe redirect', { path: redirectPath });
          return res.status(400).send('Invalid redirect path');
        }

        return res.redirect(301, redirectPath);
      }
      return handleDirectoryListing(req, res, fullPath, requestPath);
    }

    // Handle file download
    logAccess(req, 'DOWNLOAD', `size: ${stats.size} bytes`);
    return res.sendFile(fullPath);
  } catch (error) {
    logger.error('File server error', { error: error.message, path: requestPath });
    logAccess(req, 'ERROR', error.message);
    return res.status(500).send('Internal server error');
  }
});

router.put('*splat', authenticateUploads, async (req, res, next) => {
  if (req.query.action !== 'rename' && req.query.action !== 'move') {
    return next();
  }

  try {
    if (req.query.action === 'rename') {
      const { newName } = req.body;

      if (!newName || newName.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'New name is required',
        });
      }

      const sanitizedNewName = newName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const requestPath = Array.isArray(req.params.splat)
        ? req.params.splat.join('/')
        : req.params.splat || '';
      const oldFullPath = getSecurePath(requestPath);
      const parentDir = oldFullPath.substring(
        0,
        oldFullPath.lastIndexOf('/') || oldFullPath.lastIndexOf('\\')
      );
      let newFullPath = join(parentDir, sanitizedNewName);
      // Normalize and verify the new path is inside SERVED_DIR
      newFullPath = resolve(SERVED_DIR, newFullPath.replace(SERVED_DIR, ''));
      if (!newFullPath.startsWith(SERVED_DIR)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid path: operation not allowed',
        });
      }

      // Check if old file/folder exists
      try {
        await fs.access(oldFullPath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'File or folder not found',
        });
      }

      // Check if new name already exists
      try {
        await fs.access(newFullPath);
        return res.status(400).json({
          success: false,
          message: 'A file or folder with that name already exists',
        });
      } catch {
        // Good - new name doesn't exist
      }

      const oldName = basename(oldFullPath);

      // Perform the rename
      await fs.rename(oldFullPath, newFullPath);

      // Update database records
      const File = getFileModel();

      const stats = await fs.stat(newFullPath);

      if (stats.isDirectory()) {
        // For directories, update all files within
        await withDatabaseRetry(() =>
          File.update(
            {
              file_path: newFullPath,
            },
            {
              where: { file_path: oldFullPath },
            }
          )
        );

        // Update all files within the directory
        const filesInDir = await withDatabaseRetry(() =>
          File.findAll({
            where: {
              file_path: {
                [Op.like]: `${oldFullPath}%`,
              },
            },
          })
        );

        const updatePromises = filesInDir.map(file => {
          const newFilePath = file.file_path.replace(oldFullPath, newFullPath);
          return withDatabaseRetry(() => file.update({ file_path: newFilePath }));
        });

        await Promise.all(updatePromises);
      } else {
        // For files, just update the single record
        await withDatabaseRetry(() =>
          File.update(
            {
              file_path: newFullPath,
            },
            {
              where: { file_path: oldFullPath },
            }
          )
        );
      }

      // Send SSE event for real-time UI update
      // sendFileRenamed imported at top of file
      sendFileRenamed(oldFullPath, newFullPath, stats.isDirectory());

      logAccess(req, 'RENAME_SUCCESS', `${oldName} → ${sanitizedNewName}`);

      return res.json({
        success: true,
        oldName,
        newName: sanitizedNewName,
        message: `${stats.isDirectory() ? 'Folder' : 'File'} renamed successfully`,
      });
    } else if (req.query.action === 'move') {
      const { filePaths, destinationPath } = req.body;

      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'File paths array is required',
        });
      }

      const currentPath = Array.isArray(req.params.splat)
        ? req.params.splat.join('/')
        : req.params.splat || '';

      let targetDir;
      let moveDescription;

      if (destinationPath) {
        // Moving to a specific folder
        targetDir = getSecurePath(destinationPath);

        // Validate that destination is a directory and exists
        try {
          const destStats = await fs.stat(targetDir);
          if (!destStats.isDirectory()) {
            return res.status(400).json({
              success: false,
              message: 'Destination must be a directory',
            });
          }
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Destination directory does not exist',
          });
        }

        // Prevent moving items into themselves
        const invalidMoves = filePaths.filter(
          filePath => destinationPath.startsWith(filePath) || filePath === destinationPath
        );

        if (invalidMoves.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot move items into themselves',
          });
        }

        moveDescription = `to ${basename(targetDir)}`;
      } else {
        // Moving to parent directory (original behavior)
        if (currentPath === '' || currentPath === '/') {
          return res.status(400).json({
            success: false,
            message: 'Cannot move files from root directory',
          });
        }

        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        targetDir = getSecurePath(parentPath);
        moveDescription = 'to parent directory';
      }

      const movePromises = filePaths.map(async filePath => {
        const oldFullPath = getSecurePath(filePath);
        const fileName = basename(oldFullPath);
        let newFullPath = join(targetDir, fileName);

        logger.debug('Move operation paths', {
          filePath,
          oldFullPath,
          fileName,
          targetDir,
          newFullPath,
        });

        try {
          await fs.access(oldFullPath);
        } catch {
          throw new Error(`File not found: ${filePath}`);
        }

        try {
          await fs.access(newFullPath);
          const ext = extname(fileName);
          const baseName = basename(fileName, ext);

          const potentialNames = [];
          for (let counter = 1; counter < 1000; counter++) {
            potentialNames.push(`${baseName}_${counter}${ext}`);
          }

          const checkPromises = potentialNames.map(async uniqueFileName => {
            const uniqueFullPath = join(targetDir, uniqueFileName);
            try {
              await fs.access(uniqueFullPath);
              return { fileName: uniqueFileName, exists: true, path: uniqueFullPath };
            } catch {
              return { fileName: uniqueFileName, exists: false, path: uniqueFullPath };
            }
          });

          const results = await Promise.all(checkPromises);
          const availableFile = results.find(result => !result.exists);
          if (availableFile) {
            newFullPath = availableFile.path;
          }
        } catch {
          // File doesn't exist in target directory, no conflict
        }

        await fs.rename(oldFullPath, newFullPath);

        const File = getFileModel();
        const stats = await fs.stat(newFullPath);

        if (stats.isDirectory()) {
          await withDatabaseRetry(() =>
            File.update({ file_path: newFullPath }, { where: { file_path: oldFullPath } })
          );

          const filesInDir = await withDatabaseRetry(() =>
            File.findAll({
              where: {
                file_path: {
                  [Op.like]: `${oldFullPath}%`,
                },
              },
            })
          );

          const updatePromises = filesInDir.map(file => {
            const newFilePath = file.file_path.replace(oldFullPath, newFullPath);
            return withDatabaseRetry(() => file.update({ file_path: newFilePath }));
          });

          await Promise.all(updatePromises);
        } else {
          await withDatabaseRetry(() =>
            File.update({ file_path: newFullPath }, { where: { file_path: oldFullPath } })
          );
        }

        sendFileRenamed(oldFullPath, newFullPath, stats.isDirectory());
        return { oldPath: filePath, newPath: newFullPath.replace(getSecurePath(''), '') };
      });

      const movedFiles = await Promise.all(movePromises);

      logAccess(req, 'MOVE_SUCCESS', `Moved ${filePaths.length} items ${moveDescription}`);

      return res.json({
        success: true,
        movedFiles,
        message: `${filePaths.length} item${filePaths.length > 1 ? 's' : ''} moved successfully ${moveDescription}`,
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "rename" or "move"',
    });
  } catch (error) {
    const action = req.query.action === 'move' ? 'Move' : 'Rename';
    logger.error(`${action} error`, { error: error.message });
    logAccess(req, `${action.toUpperCase()}_ERROR`, error.message);
    return res.status(500).json({
      success: false,
      message: `Failed to ${action.toLowerCase()} item${req.query.action === 'move' ? 's' : ''}`,
    });
  }
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search files from root directory
 *     description: Search for files by name or checksum across all directories starting from root
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search term to look for in filenames and checksums
 *                 example: document
 *               page:
 *                 type: integer
 *                 minimum: 1
 *                 description: Page number for pagination
 *                 example: 1
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 description: Maximum number of results per page
 *                 example: 100
 *                 default: 100
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 query:
 *                   type: string
 *                   description: The search term used
 *                   example: document
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *                   description: Array of matching files
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *                     hasNext:
 *                       type: boolean
 *                       example: false
 *                     hasPrev:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Invalid search query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Handle search requests from root directory
router.post('/search', authenticateDownloads, async (req, res) => {
  try {
    const { query: searchQuery, page = 1, limit = 100 } = req.body;

    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const requestPath = '';
    const currentDir = getSecurePath(requestPath);
    const pageNum = Math.max(1, parseInt(page));
    const pageLimit = Math.min(parseInt(limit), 1000);
    const offset = (pageNum - 1) * pageLimit;

    const File = getFileModel();

    const searchConditions = {
      [Op.and]: [
        {
          file_path: {
            [Op.like]: `${currentDir}%`,
          },
        },
        {
          [Op.or]: [
            {
              file_path: {
                [Op.like]: `%${searchQuery}%`,
              },
            },
            {
              checksum_sha256: {
                [Op.like]: `%${searchQuery}%`,
              },
            },
          ],
        },
      ],
    };

    const totalCount = await File.count({
      where: searchConditions,
    });

    const searchResults = await withDatabaseRetry(() =>
      File.findAll({
        where: searchConditions,
        limit: pageLimit,
        offset,
        order: [['last_modified', 'DESC']],
        raw: true,
      })
    );

    const results = searchResults.map(file => ({
      name: basename(file.file_path),
      path: file.file_path.replace(SERVED_DIR, ''),
      size: file.file_size,
      mtime: file.last_modified,
      checksum: file.checksum_sha256 || 'Pending',
      isDirectory: file.is_directory,
    }));

    logAccess(
      req,
      'SEARCH',
      `query: "${searchQuery}", results: ${results.length}, page: ${pageNum}`
    );

    return res.json({
      success: true,
      query: searchQuery,
      results,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
        hasNext: pageNum * pageLimit < totalCount,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    logger.error('Search error', { error: error.message });
    logAccess(req, 'SEARCH_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

// Handle search requests from subdirectories
/**
 * @swagger
 * /{path}/search:
 *   post:
 *     summary: Search files in directory
 *     description: Search for files by name or checksum within the specified directory
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path to search in
 *         example: /uploads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchRequest'
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: Invalid search query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat/search', authenticateDownloads, async (req, res) => {
  try {
    const { query: searchQuery, page = 1, limit = 100 } = req.body;

    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const requestPath = decodeURIComponent(req.path.replace('/search', ''));
    const currentDir = getSecurePath(requestPath);
    const pageNum = Math.max(1, parseInt(page));
    const pageLimit = Math.min(parseInt(limit), 1000);
    const offset = (pageNum - 1) * pageLimit;

    const File = getFileModel();

    const searchConditions = {
      [Op.and]: [
        {
          file_path: {
            [Op.like]: `${currentDir}%`,
          },
        },
        {
          [Op.or]: [
            {
              file_path: {
                [Op.like]: `%${searchQuery}%`,
              },
            },
            {
              checksum_sha256: {
                [Op.like]: `%${searchQuery}%`,
              },
            },
          ],
        },
      ],
    };

    const totalCount = await File.count({
      where: searchConditions,
    });

    const searchResults = await withDatabaseRetry(() =>
      File.findAll({
        where: searchConditions,
        limit: pageLimit,
        offset,
        order: [['last_modified', 'DESC']],
        raw: true,
      })
    );

    const results = searchResults.map(file => ({
      name: basename(file.file_path),
      path: file.file_path.replace(SERVED_DIR, ''),
      size: file.file_size,
      mtime: file.last_modified,
      checksum: file.checksum_sha256 || 'Pending',
      isDirectory: file.is_directory,
    }));

    logAccess(
      req,
      'SEARCH',
      `query: "${searchQuery}", results: ${results.length}, page: ${pageNum}`
    );

    return res.json({
      success: true,
      query: searchQuery,
      results,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
        hasNext: pageNum * pageLimit < totalCount,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    logger.error('Search error', { error: error.message });
    logAccess(req, 'SEARCH_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

// Dedicated folder creation endpoint - much cleaner!
/**
 * @swagger
 * /{path}/folders:
 *   post:
 *     summary: Create folder in directory
 *     description: Create a new folder in the specified directory
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path where folder should be created
 *         example: /uploads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FolderRequest'
 *     responses:
 *       200:
 *         description: Folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 folderName:
 *                   type: string
 *                   example: new-folder
 *                 message:
 *                   type: string
 *                   example: Folder created successfully
 *       400:
 *         description: Invalid request or folder already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Handle folder creation for root directory
router.post('/folders', authenticateUploads, async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = '';
    const targetDir = getSecurePath(requestPath);
    const newFolderPath = join(targetDir, sanitizedFolderName);

    if (!newFolderPath.startsWith(SERVED_DIR)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder path',
      });
    }

    try {
      await fs.access(newFolderPath);
      return res.status(400).json({
        success: false,
        message: 'Folder already exists',
      });
    } catch {
      logger.debug(`Folder doesn't exist, proceeding with creation: ${newFolderPath}`);
    }

    await fs.mkdir(newFolderPath);

    const File = getFileModel();
    const stats = await fs.stat(newFolderPath);

    await withDatabaseRetry(() =>
      File.create({
        file_path: newFolderPath,
        file_size: 0,
        last_modified: stats.mtime,
        is_directory: true,
        checksum_status: 'complete',
      })
    );

    databaseLogger.info(`Added folder to database: ${newFolderPath}`);

    // sendFolderCreated imported at top of file
    sendFolderCreated(newFolderPath);

    logAccess(req, 'CREATE_FOLDER', `path: ${newFolderPath}`);

    return res.status(200).json({
      success: true,
      folderName: sanitizedFolderName,
      message: 'Folder created successfully',
    });
  } catch (error) {
    logger.error('Folder creation error', { error: error.message });
    logAccess(req, 'CREATE_FOLDER_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
    });
  }
});

// Handle folder creation for subdirectories
router.post('*splat/folders', authenticateUploads, async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = decodeURIComponent(req.path.replace('/folders', ''));
    const targetDir = getSecurePath(requestPath);
    const newFolderPath = join(targetDir, sanitizedFolderName);

    if (!newFolderPath.startsWith(SERVED_DIR)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder path',
      });
    }

    try {
      await fs.access(newFolderPath);
      return res.status(400).json({
        success: false,
        message: 'Folder already exists',
      });
    } catch {
      logger.debug(`Folder doesn't exist, proceeding with creation: ${newFolderPath}`);
    }

    await fs.mkdir(newFolderPath);

    const File = getFileModel();
    const stats = await fs.stat(newFolderPath);

    await withDatabaseRetry(() =>
      File.create({
        file_path: newFolderPath,
        file_size: 0,
        last_modified: stats.mtime,
        is_directory: true,
        checksum_status: 'complete',
      })
    );

    databaseLogger.info(`Added folder to database: ${newFolderPath}`);

    // sendFolderCreated imported at top of file
    sendFolderCreated(newFolderPath);

    logAccess(req, 'CREATE_FOLDER', `path: ${newFolderPath}`);

    return res.status(200).json({
      success: true,
      folderName: sanitizedFolderName,
      message: 'Folder created successfully',
    });
  } catch (error) {
    logger.error('Folder creation error', { error: error.message });
    logAccess(req, 'CREATE_FOLDER_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
    });
  }
});

// Keep legacy support for backwards compatibility
router.post('*splat', (req, res, next) => {
  if (req.query.auth === '1') {
    return authenticateUploads(req, res, () => {
      res.status(200).send('Authenticated');
    });
  } else if (req.query.action === 'create-folder') {
    const newPath = `${req.path}/folders`;

    // Only allow strictly relative paths, no path traversal, not protocol-relative, not external host
    const isSafeRelativePath = path => {
      // must start with a single "/"
      if (typeof path !== 'string' || !path.startsWith('/')) {
        return false;
      }
      // must not contain "//"
      if (path.includes('//')) {
        return false;
      }
      // must not contain ".."
      if (path.includes('..')) {
        return false;
      }
      // optional: restrict to allowed base directory/prefix
      return true;
    };

    if (!isSafeRelativePath(newPath)) {
      logger.warn('Rejected potentially unsafe redirect', { path: newPath });
      return res.status(400).send('Invalid redirect path');
    }

    return res.redirect(307, newPath);
  } else if (req.query.action === 'search') {
    const newPath = `${req.path}/search`;

    if (!isLocalUrl(newPath)) {
      logger.warn('Rejected potentially unsafe redirect', { path: newPath });
      return res.status(400).send('Invalid redirect path');
    }

    return res.redirect(307, newPath);
  }
  return next();
});

/**
 * @swagger
 * /{path}:
 *   put:
 *     summary: Rename or move files/folders
 *     description: Rename a file or folder to a new name, or move multiple files to parent directory
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Current file/folder path (for rename) or directory path (for move)
 *         example: /uploads/oldname.txt
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [rename, move]
 *         description: Action to perform - 'rename' for single item rename, 'move' for moving multiple items to parent directory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 title: Rename Request
 *                 required: [newName]
 *                 properties:
 *                   newName:
 *                     type: string
 *                     description: New name for the file or folder (for rename action)
 *                     example: newname.txt
 *               - type: object
 *                 title: Move Request
 *                 required: [filePaths]
 *                 properties:
 *                   filePaths:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of file paths to move to parent directory (for move action)
 *                     example: ["/uploads/subdir/file1.txt", "/uploads/subdir/file2.txt"]
 *     responses:
 *       200:
 *         description: Operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   title: Rename Response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     oldName:
 *                       type: string
 *                       example: oldname.txt
 *                     newName:
 *                       type: string
 *                       example: newname.txt
 *                     message:
 *                       type: string
 *                       example: File renamed successfully
 *                 - type: object
 *                   title: Move Response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     movedFiles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           oldPath:
 *                             type: string
 *                             example: /uploads/subdir/file1.txt
 *                           newPath:
 *                             type: string
 *                             example: /uploads/file1.txt
 *                     message:
 *                       type: string
 *                       example: 2 items moved successfully
 *       400:
 *         description: Invalid request, name conflict, or cannot move from root directory
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat', authenticateUploads, async (req, res, next) => {
  if (req.query.action !== 'create-folder') {
    return next();
  }

  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    const newFolderPath = join(targetDir, sanitizedFolderName);

    if (!newFolderPath.startsWith(SERVED_DIR)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder path',
      });
    }

    try {
      await fs.access(newFolderPath);
      return res.status(400).json({
        success: false,
        message: 'Folder already exists',
      });
    } catch {
      logger.debug(`Folder doesn't exist, proceeding with creation: ${newFolderPath}`);
    }

    await fs.mkdir(newFolderPath);

    const File = getFileModel();
    const stats = await fs.stat(newFolderPath);

    await withDatabaseRetry(() =>
      File.create({
        file_path: newFolderPath,
        file_size: 0,
        last_modified: stats.mtime,
        is_directory: true,
        checksum_status: 'complete',
      })
    );

    databaseLogger.info(`Added folder to database: ${newFolderPath}`);

    // sendFolderCreated imported at top of file
    sendFolderCreated(newFolderPath);

    logAccess(req, 'CREATE_FOLDER', `path: ${newFolderPath}`);

    return res.status(200).json({
      success: true,
      folderName: sanitizedFolderName,
      message: 'Folder created successfully',
    });
  } catch (error) {
    logger.error('Folder creation error', { error: error.message });
    logAccess(req, 'CREATE_FOLDER_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
    });
  }
});

/**
 * @swagger
 * /{path}:
 *   post:
 *     summary: Upload file
 *     description: Upload a file to the specified directory path
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path where file should be uploaded
 *         example: /uploads/
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: No file provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat', authenticateUploads, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      logAccess(req, 'UPLOAD_FAILED', 'no file provided');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    req.fileWatcher.markUploadComplete(req.file.path);

    const File = getFileModel();

    logger.info('Upload duplicate check', {
      uploadedFilePath: req.file.path,
      filename: req.file.filename,
    });

    const existingFile = await withDatabaseRetry(() =>
      File.findOne({ where: { file_path: req.file.path } })
    );

    logger.info('Duplicate check result', {
      existingFile: !!existingFile,
      existingFilePath: existingFile?.file_path,
    });

    const uploadType = existingFile ? 'replacement' : 'new';

    logAccess(
      req,
      'UPLOAD_SUCCESS',
      `file: ${req.file.filename}, size: ${req.file.size} bytes, type: ${uploadType}`
    );

    return res.status(200).json({
      success: true,
      type: uploadType,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    if (req.file?.path) {
      req.fileWatcher.markUploadComplete(req.file.path);
    }

    logger.error('Upload error', { error: error.message, filename: req.file?.filename });
    logAccess(req, 'UPLOAD_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Upload failed',
    });
  }
});

/**
 * @swagger
 * /{path}:
 *   delete:
 *     summary: Delete file or directory
 *     description: Delete a file or directory (recursively) at the specified path. Requires upload permissions (admin level).
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File or directory path to delete
 *         example: /uploads/document.pdf
 *     responses:
 *       200:
 *         description: File or directory deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Cannot delete directory (permission or system error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or directory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('*splat', authenticateDelete, async (req, res) => {
  const requestPath = Array.isArray(req.params.splat)
    ? req.params.splat.join('/')
    : req.params.splat || '';

  try {
    const fullPath = getSecurePath(requestPath);

    try {
      await fs.access(fullPath);
    } catch {
      logAccess(req, 'DELETE_NOT_FOUND', fullPath);
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      try {
        await fs.rm(fullPath, { recursive: true, force: true });

        const File = getFileModel();
        await withDatabaseRetry(() =>
          File.destroy({
            where: {
              file_path: {
                [Op.like]: `${fullPath}%`,
              },
            },
          })
        );

        // sendFileDeleted imported at top of file
        sendFileDeleted(fullPath, true);

        logAccess(req, 'DELETE_DIRECTORY', `path: ${fullPath} (recursive)`);
        return res.json({
          success: true,
          message: 'Directory deleted successfully',
        });
      } catch (error) {
        logAccess(req, 'DELETE_DIRECTORY_FAILED', `path: ${fullPath}, error: ${error.message}`);
        return res.status(400).json({
          success: false,
          message: `Cannot delete directory: ${error.message}`,
        });
      }
    } else {
      await fs.unlink(fullPath);

      const File = getFileModel();
      await withDatabaseRetry(() => File.destroy({ where: { file_path: fullPath } }));

      // sendFileDeleted imported at top of file
      sendFileDeleted(fullPath, false);

      logAccess(req, 'DELETE_FILE', `path: ${fullPath}, size: ${stats.size} bytes`);
      return res.json({
        success: true,
        message: 'File deleted successfully',
      });
    }
  } catch (error) {
    logger.error('Delete error', { error: error.message, path: requestPath });
    logAccess(req, 'DELETE_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file',
    });
  }
});

export default router;
