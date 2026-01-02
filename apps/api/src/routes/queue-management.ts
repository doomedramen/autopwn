import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { jobs, networks, dictionaries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  addPCAPProcessingJob,
  addHashcatCrackingJob,
  addDictionaryGenerationJob,
  addFileCleanupJob,
  QUEUE_NAMES,
} from "@/lib/queue";
import { authenticate, getUserId } from "@/middleware/auth";

const queueManagement = new Hono();

// Apply authentication middleware to all routes
queueManagement.use("*", authenticate);

// Create cracking job
queueManagement.post(
  "/crack",
  zValidator(
    "json",
    z.object({
      networkId: z.string().min(1),
      dictionaryId: z.string().min(1),
      attackMode: z.enum(["pmkid", "handshake"]).default("handshake"),
    }),
  ),
  async (c) => {
    const data = c.req.valid("json");
    const userId = getUserId(c);

    try {
      // Verify network exists and has handshake/PMKID
      const network = await db.query.networks.findFirst({
        where: eq(networks.id, data.networkId),
      });

      if (!network) {
        return c.json(
          {
            success: false,
            error: "Network not found",
          },
          404,
        );
      }

      // Verify dictionary exists
      const dictionary = await db.query.dictionaries.findFirst({
        where: eq(dictionaries.id, data.dictionaryId),
      });

      if (!dictionary) {
        return c.json(
          {
            success: false,
            error: "Dictionary not found",
          },
          404,
        );
      }

      // Create job record
      const [newJob] = await db
        .insert(jobs)
        .values({
          name: `Cracking Job for ${network.ssid || network.bssid}`,
          networkId: data.networkId,
          dictionaryId: data.dictionaryId,
          status: "pending",
          config: {
            attackMode: data.attackMode,
            queued: true,
            type: "cracking",
          },
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Add to queue
      await addHashcatCrackingJob({
        jobId: newJob.id,
        networkId: data.networkId,
        dictionaryId: data.dictionaryId,
        handshakePath: network.filePath || "", // This would be the extracted handshake file
        dictionaryPath: dictionary.filePath || "",
        attackMode: data.attackMode,
        userId,
      });

      return c.json({
        success: true,
        message: "Cracking job queued successfully",
        job: {
          id: newJob.id,
          networkId: data.networkId,
          dictionaryId: data.dictionaryId,
          attackMode: data.attackMode,
          status: "pending",
          createdAt: newJob.createdAt,
        },
      });
    } catch (error) {
      console.error("Create cracking job error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to create cracking job",
        },
        500,
      );
    }
  },
);

// Generate dictionary job
queueManagement.post(
  "/dictionary/generate",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(255),
      baseWords: z.array(z.string()).optional(),
      rules: z.array(z.string()).optional(),
      transformations: z.array(z.string()).optional(),
      async: z.boolean().optional().default(true),
    }),
  ),
  async (c) => {
    const data = c.req.valid("json");
    const userId = getUserId(c);

    try {
      // Validate dictionary name uniqueness for user
      const existingDictionary = await db.query.dictionaries.findFirst({
        where: and(
          eq(dictionaries.name, data.name),
          eq(dictionaries.userId, userId),
        ),
      });

      if (existingDictionary) {
        return c.json(
          {
            success: false,
            error: "Dictionary name already exists",
            message:
              "You already have a dictionary with this name. Please choose a different name.",
          },
          400,
        );
      }

      // Validate input size to prevent resource exhaustion
      if (data.baseWords && data.baseWords.length > 10000) {
        return c.json(
          {
            success: false,
            error: "Too many base words",
            message:
              "Maximum 10,000 base words allowed per dictionary generation request.",
          },
          400,
        );
      }

      if (data.rules && data.rules.length > 100) {
        return c.json(
          {
            success: false,
            error: "Too many rules",
            message:
              "Maximum 100 rules allowed per dictionary generation request.",
          },
          400,
        );
      }

      if (data.transformations && data.transformations.length > 50) {
        return c.json(
          {
            success: false,
            error: "Too many transformations",
            message:
              "Maximum 50 transformations allowed per dictionary generation request.",
          },
          400,
        );
      }

      if (data.async) {
        // Add to queue for asynchronous processing
        const job = await addDictionaryGenerationJob({
          name: data.name,
          baseWords: data.baseWords || [],
          rules: data.rules || [],
          transformations: data.transformations || [],
          userId,
        });

        return c.json({
          success: true,
          message: "Dictionary generation job queued successfully",
          job: {
            id: job.id,
            name: data.name,
            baseWords: data.baseWords?.length || 0,
            rules: data.rules?.length || 0,
            transformations: data.transformations?.length || 0,
            status: "queued",
          },
          estimatedTime:
            "Dictionary generation will begin shortly and may take several minutes depending on complexity.",
        });
      } else {
        // Synchronous generation for smaller requests
        if (data.baseWords && data.baseWords.length > 1000) {
          return c.json(
            {
              success: false,
              error: "Request too large for synchronous generation",
              message:
                "Requests with more than 1,000 base words must be processed asynchronously. Please set async=true.",
            },
            400,
          );
        }

        // Import generateDictionary function for synchronous processing
        const { generateDictionary } = await import(
          "@/workers/dictionary-generation"
        );

        const newDictionary = await generateDictionary({
          name: data.name,
          baseWords: data.baseWords || [],
          rules: data.rules || [],
          transformations: data.transformations || [],
          userId,
        });

        return c.json({
          success: true,
          message: "Dictionary generated successfully",
          dictionary: newDictionary,
        });
      }
    } catch (error) {
      console.error("Generate dictionary job error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to generate dictionary",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        500,
      );
    }
  },
);

// Get queue statistics
queueManagement.get("/stats", async (c) => {
  try {
    // Get job counts by status
    const [pendingJobs, runningJobs, completedJobs, failedJobs] =
      await Promise.all([
        db.select().from(jobs).where(eq(jobs.status, "pending")),
        db.select().from(jobs).where(eq(jobs.status, "running")),
        db.select().from(jobs).where(eq(jobs.status, "completed")),
        db.select().from(jobs).where(eq(jobs.status, "failed")),
      ]);

    // Get recent jobs
    const recentJobs = await db.query.jobs.findMany({
      where: eq(jobs.userId, getUserId(c)),
      with: {
        network: true,
        dictionary: true,
      },
      orderBy: [(jobs, { desc }) => [desc(jobs.createdAt)]],
      limit: 10,
    });

    return c.json({
      success: true,
      stats: {
        pending: pendingJobs.length,
        running: runningJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        total:
          pendingJobs.length +
          runningJobs.length +
          completedJobs.length +
          failedJobs.length,
      },
      recentJobs,
      queues: {
        [QUEUE_NAMES.PCAP_PROCESSING]: "PCAP Processing",
        [QUEUE_NAMES.HASHCAT_CRACKING]: "Hashcat Cracking",
        [QUEUE_NAMES.DICTIONARY_GENERATION]: "Dictionary Generation",
        [QUEUE_NAMES.FILE_CLEANUP]: "File Cleanup",
      },
    });
  } catch (error) {
    console.error("Get queue stats error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get queue statistics",
      },
      500,
    );
  }
});

// Get predefined word lists and transformation options
queueManagement.get("/dictionary/templates", async (c) => {
  try {
    const { defaultWordLists } = await import(
      "@/workers/dictionary-generation"
    );

    const templates = {
      wordLists: {
        commonPasswords: {
          name: "Common Passwords",
          description: "Most frequently used passwords",
          words: defaultWordLists.commonPasswords,
        },
        commonWords: {
          name: "Common Words",
          description: "Frequently used English words",
          words: defaultWordLists.commonWords,
        },
        numbers: {
          name: "Numbers",
          description: "Single digits",
          words: defaultWordLists.numbers,
        },
        months: {
          name: "Months",
          description: "Month names",
          words: defaultWordLists.months,
        },
      },
      transformations: [
        {
          id: "upper",
          name: "Uppercase",
          description: "Convert all letters to uppercase",
        },
        {
          id: "lower",
          name: "Lowercase",
          description: "Convert all letters to lowercase",
        },
        {
          id: "capitalize",
          name: "Capitalize",
          description: "Capitalize first letter only",
        },
        { id: "reverse", name: "Reverse", description: "Reverse the word" },
        {
          id: "leet",
          name: "Leet Speak",
          description: "Replace letters with numbers (e=3, a=4, o=0, s=5)",
        },
        {
          id: "duplicate",
          name: "Duplicate",
          description: "Duplicate the word (password -> passwordpassword)",
        },
        {
          id: "append_year",
          name: "Append Year",
          description: "Append current year (2024)",
        },
        { id: "append_1", name: "Append 1", description: "Append number 1" },
        { id: "prepend_1", name: "Prepend 1", description: "Prepend number 1" },
      ],
      commonRules: [
        { rule: ":", name: "No Change", description: "Keep word as is" },
        { rule: "u", name: "Uppercase", description: "Convert to uppercase" },
        { rule: "l", name: "Lowercase", description: "Convert to lowercase" },
        {
          rule: "c",
          name: "Capitalize",
          description: "Capitalize first letter",
        },
        { rule: "r", name: "Reverse", description: "Reverse the word" },
        { rule: "d", name: "Duplicate", description: "Duplicate the word" },
        { rule: "$1", name: "Append 1", description: "Append number 1" },
        {
          rule: "$!",
          name: "Append !",
          description: "Append exclamation mark",
        },
        { rule: "^1", name: "Prepend 1", description: "Prepend number 1" },
        {
          rule: "^!",
          name: "Prepend !",
          description: "Prepend exclamation mark",
        },
      ],
    };

    return c.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get dictionary templates error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get dictionary templates",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      500,
    );
  }
});

// Cancel job
queueManagement.delete("/jobs/:id", async (c) => {
  const jobId = c.req.param("id");
  const userId = getUserId(c);

  try {
    // Update job status to cancelled
    const [cancelledJob] = await db
      .update(jobs)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
      .returning();

    if (!cancelledJob) {
      return c.json(
        {
          success: false,
          error: "Job not found or you do not have permission to cancel it",
        },
        404,
      );
    }

    // Note: In BullMQ, you would also want to cancel the job in the queue
    // This would require access to the queue instance and job ID from BullMQ

    return c.json({
      success: true,
      message: "Job cancelled successfully",
      job: cancelledJob,
    });
  } catch (error) {
    console.error("Cancel job error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to cancel job",
      },
      500,
    );
  }
});

// Retry failed job
queueManagement.post("/jobs/:id/retry", async (c) => {
  const jobId = c.req.param("id");
  const userId = getUserId(c);

  try {
    // Get the failed job
    const failedJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.id, jobId),
        eq(jobs.userId, userId),
        eq(jobs.status, "failed"),
      ),
      with: {
        network: true,
        dictionary: true,
      },
    });

    if (!failedJob) {
      return c.json(
        {
          success: false,
          error:
            "Failed job not found or you do not have permission to retry it",
        },
        404,
      );
    }

    // Reset job status
    const [retriedJob] = await db
      .update(jobs)
      .set({
        status: "pending",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning();

    // Re-add to queue based on job type
    if (failedJob.networkId && failedJob.dictionaryId) {
      await addHashcatCrackingJob({
        jobId: failedJob.id,
        networkId: failedJob.networkId,
        dictionaryId: failedJob.dictionaryId,
        handshakePath: failedJob.network?.filePath || "",
        dictionaryPath: failedJob.dictionary?.filePath || "",
        attackMode:
          (failedJob.attackMode as "pmkid" | "handshake") || "handshake",
        userId,
      });
    }

    return c.json({
      success: true,
      message: "Job queued for retry",
      job: retriedJob,
    });
  } catch (error) {
    console.error("Retry job error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to retry job",
      },
      500,
    );
  }
});

// Cleanup job
queueManagement.post(
  "/cleanup",
  zValidator(
    "json",
    z.object({
      strategy: z.enum([
        "old_files",
        "failed_jobs",
        "completed_jobs",
        "temp_files",
      ]),
      userId: z.string().optional(),
    }),
  ),
  async (c) => {
    const data = c.req.valid("json");
    const userId = data.userId || getUserId(c);

    try {
      // Add cleanup job to queue
      await addFileCleanupJob({
        filePaths: [],
        userId,
      });

      return c.json({
        success: true,
        message: "Cleanup job queued successfully",
        strategy: data.strategy,
      });
    } catch (error) {
      console.error("Cleanup job error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to queue cleanup job",
        },
        500,
      );
    }
  },
);

export {
  queueManagement as queueManagementRoutes,
  queueManagement as queueRoutes,
};
