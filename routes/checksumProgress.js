import express from 'express';
import { getFileModel } from '../models/File.js';
import { withDatabaseRetry } from '../config/database.js';
import { authenticateDownloads } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';
import checksumService from '../services/checksumService.js';

const router = express.Router();

/**
 * @swagger
 * /api/checksum/progress:
 *   get:
 *     summary: Get checksum processing progress
 *     description: Returns current status of file checksum generation including totals, completion counts, and percentage
 *     tags: [Checksum]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     responses:
 *       200:
 *         description: Progress information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   description: Total number of files (excluding directories)
 *                   example: 834
 *                 complete:
 *                   type: integer
 *                   description: Number of files with completed checksums
 *                   example: 820
 *                 pending:
 *                   type: integer
 *                   description: Number of files waiting for checksum processing
 *                   example: 10
 *                 generating:
 *                   type: integer
 *                   description: Number of files currently being processed
 *                   example: 3
 *                 error:
 *                   type: integer
 *                   description: Number of files with checksum errors
 *                   example: 1
 *                 percentage:
 *                   type: number
 *                   description: Completion percentage (0-100)
 *                   example: 98.3
 *                 isActive:
 *                   type: boolean
 *                   description: Whether checksum processing is currently active
 *                   example: true
 *                 activeProcessing:
 *                   type: integer
 *                   description: Number of files currently being processed by workers
 *                   example: 2
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
router.get('/', authenticateDownloads, async (req, res) => {
  try {
    logger.info(`Checksum progress requested from ${req.ip || 'unknown IP'}`);
    const File = getFileModel();

    // Get progress statistics for files only (excluding directories)
    const results = await withDatabaseRetry(() =>
      File.findAll({
        where: {
          is_directory: false,
        },
        attributes: [
          [File.sequelize.fn('COUNT', '*'), 'total'],
          [
            File.sequelize.fn(
              'SUM',
              File.sequelize.literal("CASE WHEN checksum_status = 'complete' THEN 1 ELSE 0 END")
            ),
            'complete',
          ],
          [
            File.sequelize.fn(
              'SUM',
              File.sequelize.literal("CASE WHEN checksum_status = 'pending' THEN 1 ELSE 0 END")
            ),
            'pending',
          ],
          [
            File.sequelize.fn(
              'SUM',
              File.sequelize.literal("CASE WHEN checksum_status = 'generating' THEN 1 ELSE 0 END")
            ),
            'generating',
          ],
          [
            File.sequelize.fn(
              'SUM',
              File.sequelize.literal("CASE WHEN checksum_status = 'error' THEN 1 ELSE 0 END")
            ),
            'error',
          ],
        ],
        raw: true,
      })
    );

    const [stats] = results;
    const total = parseInt(stats.total) || 0;
    const complete = parseInt(stats.complete) || 0;
    const pending = parseInt(stats.pending) || 0;
    const generating = parseInt(stats.generating) || 0;
    const error = parseInt(stats.error) || 0;

    // Calculate percentage
    const percentage = total > 0 ? (complete / total) * 100 : 100;

    // Get active processing count from checksum service
    const activeProcessing = checksumService.activeChecksums
      ? checksumService.activeChecksums.size
      : 0;

    // Determine if processing is active
    const isActive = pending > 0 || generating > 0 || activeProcessing > 0;

    const progressData = {
      success: true,
      total,
      complete,
      pending,
      generating,
      error,
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
      isActive,
      activeProcessing,
    };

    return res.json(progressData);
  } catch (error) {
    logger.error('Checksum progress error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve checksum progress',
    });
  }
});

export default router;
