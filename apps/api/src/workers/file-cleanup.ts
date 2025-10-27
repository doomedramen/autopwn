import { promises as fs } from 'fs'
import path from 'path'
import { env } from '@/config/env'
import { db } from '@/db'
import { networks, dictionaries, jobs } from '@/db/schema'
import { eq, lt, or } from 'drizzle-orm'

interface CleanupFilesOptions {
  filePaths: string[]
  olderThan?: Date
  userId?: string
}

export async function cleanupFiles({
  filePaths,
  olderThan,
  userId
}: CleanupFilesOptions) {
  try {
    let filesToDelete = [...filePaths]

    // If olderThan is specified, find old files
    if (olderThan) {
      const oldFiles = await findOldFiles(olderThan, userId)
      filesToDelete = [...filesToDelete, ...oldFiles]
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(filesToDelete)]

    // Delete files
    const deletedFiles: string[] = []
    const failedFiles: Array<{ path: string; error: string }> = []

    for (const filePath of uniqueFiles) {
      try {
        await fs.unlink(filePath)
        deletedFiles.push(filePath)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        failedFiles.push({
          path: filePath,
          error: errorMessage
        })
      }
    }

    // Clean up empty directories
    await cleanupEmptyDirectories()

    // Update database records for deleted files
    await updateDatabaseForDeletedFiles(deletedFiles)

    return {
      success: true,
      deletedFiles: deletedFiles.length,
      failedFiles: failedFiles.length,
      files: deletedFiles,
      errors: failedFiles
    }

  } catch (error) {
    throw new Error(`File cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function findOldFiles(olderThan: Date, userId?: string): Promise<string[]> {
  const oldFiles: string[] = []

  // Find old networks with files
  const oldNetworksQuery = db.select({ filePath: networks.filePath })
    .from(networks)
    .where(
      and(
        lt(networks.updatedAt, olderThan),
        userId ? eq(networks.userId, userId) : undefined,
        eq(networks.status, 'ready') // Only clean up completed networks
      )
    )

  const oldNetworks = await oldNetworksQuery
  oldFiles.push(...oldNetworks.map(n => n.filePath).filter(Boolean))

  // Find old dictionaries with files
  const oldDictionariesQuery = db.select({ filePath: dictionaries.filePath })
    .from(dictionaries)
    .where(
      and(
        lt(dictionaries.updatedAt, olderThan),
        userId ? eq(dictionaries.userId, userId) : undefined,
        eq(dictionaries.status, 'ready') // Only clean up ready dictionaries
      )
    )

  const oldDictionaries = await oldDictionariesQuery
  oldFiles.push(...oldDictionaries.map(d => d.filePath).filter(Boolean))

  // Find temporary files in upload directories
  const uploadDirs = [
    path.join(process.cwd(), env.UPLOAD_DIR, 'pcap'),
    path.join(process.cwd(), env.UPLOAD_DIR, 'dictionaries'),
    path.join(process.cwd(), 'temp', 'hashcat'),
    path.join(process.cwd(), 'temp', 'dict-generation')
  ]

  for (const dir of uploadDirs) {
    try {
      const files = await fs.readdir(dir, { recursive: true })

      for (const file of files) {
        const filePath = path.join(dir, file)

        try {
          const stats = await fs.stat(filePath)
          if (stats.isFile() && stats.mtime < olderThan) {
            oldFiles.push(filePath)
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
    }
  }

  return oldFiles.filter(Boolean)
}

async function cleanupEmptyDirectories() {
  const dirsToClean = [
    path.join(process.cwd(), env.UPLOAD_DIR, 'pcap'),
    path.join(process.cwd(), env.UPLOAD_DIR, 'dictionaries'),
    path.join(process.cwd(), 'temp', 'hashcat'),
    path.join(process.cwd(), 'temp', 'dict-generation')
  ]

  for (const dir of dirsToClean) {
    try {
      await cleanEmptyDirectory(dir)
    } catch (error) {
      console.error(`Error cleaning directory ${dir}:`, error)
    }
  }
}

async function cleanEmptyDirectory(dir: string) {
  try {
    const files = await fs.readdir(dir)

    if (files.length === 0) {
      // Directory is empty, try to remove it
      await fs.rmdir(dir)
      return
    }

    // Recursively clean subdirectories
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = await fs.stat(filePath)

      if (stats.isDirectory()) {
        await cleanEmptyDirectory(filePath)
      }
    }

    // Check if directory is now empty
    const remainingFiles = await fs.readdir(dir)
    if (remainingFiles.length === 0) {
      await fs.rmdir(dir)
    }
  } catch (error) {
    // Directory might not exist or can't be accessed
  }
}

async function updateDatabaseForDeletedFiles(deletedFiles: string[]) {
  for (const filePath of deletedFiles) {
    try {
      // Update networks that had this file
      await db.update(networks)
        .set({
          filePath: null,
          notes: 'File has been cleaned up',
          updatedAt: new Date()
        })
        .where(eq(networks.filePath, filePath))

      // Update dictionaries that had this file
      await db.update(dictionaries)
        .set({
          filePath: null,
          status: 'deleted',
          updatedAt: new Date()
        })
        .where(eq(dictionaries.filePath, filePath))
    } catch (error) {
      console.error(`Error updating database for deleted file ${filePath}:`, error)
    }
  }
}

// Cleanup strategy functions
export const cleanupStrategies = {
  // Clean up files older than 30 days
  async cleanupOldFiles(userId?: string) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return cleanupFiles({
      filePaths: [],
      olderThan: thirtyDaysAgo,
      userId
    })
  },

  // Clean up failed job files
  async cleanupFailedJobs(userId?: string) {
    const failedJobs = await db.select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'failed'),
          userId ? eq(jobs.userId, userId) : undefined,
          lt(jobs.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days ago
        )
      )

    const tempDirs = failedJobs.map(job =>
      path.join(process.cwd(), 'temp', 'hashcat', job.id)
    )

    return cleanupFiles({
      filePaths: tempDirs,
      userId
    })
  },

  // Clean up completed jobs older than 7 days
  async cleanupCompletedJobs(userId?: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const completedJobs = await db.select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'completed'),
          userId ? eq(jobs.userId, userId) : undefined,
          lt(jobs.completedAt!, sevenDaysAgo)
        )
      )

    const tempDirs = completedJobs.map(job =>
      path.join(process.cwd(), 'temp', 'hashcat', job.id)
    )

    return cleanupFiles({
      filePaths: tempDirs,
      userId
    })
  },

  // Clean up temporary files
  async cleanupTempFiles() {
    const tempDirs = [
      path.join(process.cwd(), 'temp', 'hashcat'),
      path.join(process.cwd(), 'temp', 'dict-generation')
    ]

    const filesToDelete: string[] = []

    for (const dir of tempDirs) {
      try {
        const files = await fs.readdir(dir, { recursive: true })

        for (const file of files) {
          const filePath = path.join(dir, file)
          const stats = await fs.stat(filePath)

          // Clean up temp files older than 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          if (stats.isFile() && stats.mtime < oneDayAgo) {
            filesToDelete.push(filePath)
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    return cleanupFiles({
      filePaths: filesToDelete
    })
  }
}

// Helper function to combine conditions
function and(...conditions: (any | undefined)[]) {
  return conditions.filter(Boolean).length > 0 ? conditions.filter(Boolean)[0] : undefined
}