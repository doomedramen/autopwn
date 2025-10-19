import type { FastifyInstance } from 'fastify';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import { captures } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { canAccessResource } from '../lib/rbac';
import { saveFile, deleteFile, validateFileExtension, validateFileSize } from '../lib/storage';
import { addCaptureProcessingJob } from '../lib/queue';
import { env } from '../config';

/**
 * Capture Routes
 *
 * Handles PCAP file uploads and management
 */

export async function captureRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/captures/upload
   * Upload a PCAP file
   */
  fastify.post(
    '/api/captures/upload',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'NO_FILE',
              message: 'No file provided',
            },
          });
        }

        // Validate file extension
        const allowedExtensions = ['.pcap', '.pcapng', '.cap'];
        if (!validateFileExtension(data.filename, allowedExtensions)) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `File must be one of: ${allowedExtensions.join(', ')}`,
            },
          });
        }

        // Get file buffer to check size
        const buffer = await data.toBuffer();

        // Validate file size
        if (!validateFileSize(buffer.length, env.MAX_PCAP_SIZE)) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size exceeds maximum of ${env.MAX_PCAP_SIZE} bytes`,
            },
          });
        }

        // Save file to disk
        const { filename, filePath, fileSize } = await saveFile(
          buffer,
          data.filename,
          'uploads'
        );

        // Create database record
        const [capture] = await db
          .insert(captures)
          .values({
            userId: request.user!.id,
            filename,
            originalFilename: data.filename,
            filePath,
            fileSize,
            status: 'pending',
          })
          .returning();

        // Queue processing job
        await addCaptureProcessingJob({
          captureId: capture.id,
          userId: request.user!.id,
          filePath: capture.filePath,
        });

        return {
          success: true,
          data: {
            id: capture.id,
            filename: capture.originalFilename,
            fileSize: capture.fileSize,
            status: capture.status,
            uploadedAt: capture.uploadedAt,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Capture upload error');
        return reply.code(500).send({
          success: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: 'Failed to upload capture',
          },
        });
      }
    }
  );

  /**
   * GET /api/captures
   * List all captures for the current user
   */
  fastify.get(
    '/api/captures',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userCaptures = await db.query.captures.findMany({
          where: and(
            eq(captures.userId, request.user!.id),
            isNull(captures.deletedAt)
          ),
          orderBy: [desc(captures.uploadedAt)],
        });

        return {
          success: true,
          data: {
            items: userCaptures.map((c) => ({
              id: c.id,
              filename: c.originalFilename,
              fileSize: c.fileSize,
              status: c.status,
              networkCount: c.networkCount,
              uploadedAt: c.uploadedAt,
              processedAt: c.processedAt,
              errorMessage: c.errorMessage,
            })),
            total: userCaptures.length,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'List captures error');
        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list captures',
          },
        });
      }
    }
  );

  /**
   * GET /api/captures/:id
   * Get a specific capture by ID
   */
  fastify.get(
    '/api/captures/:id',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const capture = await db.query.captures.findFirst({
          where: and(eq(captures.id, id), isNull(captures.deletedAt)),
        });

        if (!capture) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Capture not found',
            },
          });
        }

        // Check access permissions
        if (!canAccessResource(request.user!, capture.userId)) {
          return reply.code(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this capture',
            },
          });
        }

        return {
          success: true,
          data: {
            id: capture.id,
            filename: capture.originalFilename,
            fileSize: capture.fileSize,
            status: capture.status,
            networkCount: capture.networkCount,
            uploadedAt: capture.uploadedAt,
            processedAt: capture.processedAt,
            errorMessage: capture.errorMessage,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Get capture error');
        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get capture',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/captures/:id
   * Delete a capture (soft delete)
   */
  fastify.delete(
    '/api/captures/:id',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const capture = await db.query.captures.findFirst({
          where: and(eq(captures.id, id), isNull(captures.deletedAt)),
        });

        if (!capture) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Capture not found',
            },
          });
        }

        // Check delete permissions
        if (!canAccessResource(request.user!, capture.userId)) {
          return reply.code(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to delete this capture',
            },
          });
        }

        // Soft delete (mark as deleted)
        await db
          .update(captures)
          .set({ deletedAt: new Date() })
          .where(eq(captures.id, id));

        // Delete physical file
        try {
          await deleteFile(capture.filePath);
        } catch (error) {
          fastify.log.warn({ error, filePath: capture.filePath }, 'Failed to delete file');
          // Continue anyway - DB record is marked deleted
        }

        return {
          success: true,
          data: {
            message: 'Capture deleted successfully',
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Delete capture error');
        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete capture',
          },
        });
      }
    }
  );
}
