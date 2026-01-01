import { db } from "./index";
import { config } from "./schema";

const initialConfig = [
  {
    id: "maxConcurrentJobs",
    value: 2,
    description: "Maximum number of hashcat jobs that can run concurrently",
    category: "performance" as const,
    type: "number" as const,
    defaultValue: 2,
    minValue: 1,
    maxValue: 10,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "maxPcapSize",
    value: 524288000,
    description: "Maximum PCAP file upload size in bytes",
    category: "general" as const,
    type: "number" as const,
    defaultValue: 524288000,
    minValue: 1048576,
    maxValue: 2147483648,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "maxDictionarySize",
    value: 10737418240,
    description: "Maximum dictionary file size in bytes",
    category: "general" as const,
    type: "number" as const,
    defaultValue: 10737418240,
    minValue: 1048576,
    maxValue: 5368709120,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "maxGeneratedDictSize",
    value: 21474836480,
    description: "Maximum generated dictionary file size in bytes",
    category: "general" as const,
    type: "number" as const,
    defaultValue: 21474836480,
    minValue: 1048576,
    maxValue: 107374182400,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "hashcatDefaultWorkload",
    value: 3,
    description:
      "Default hashcat workload profile (1-4, higher = more GPU usage)",
    category: "performance" as const,
    type: "number" as const,
    defaultValue: 3,
    minValue: 1,
    maxValue: 4,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "hashcatJobTimeout",
    value: 86400,
    description: "Maximum hashcat job execution time in seconds before timeout",
    category: "performance" as const,
    type: "number" as const,
    defaultValue: 86400,
    minValue: 60,
    maxValue: 604800,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "allowUserRegistration",
    value: false,
    description:
      "Allow new user registration (false = admin creates all users)",
    category: "security" as const,
    type: "boolean" as const,
    defaultValue: false,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "sessionExpiry",
    value: 604800,
    description: "User session expiry time in seconds",
    category: "security" as const,
    type: "number" as const,
    defaultValue: 604800,
    minValue: 3600,
    maxValue: 2592000,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "cache-dictionaries",
    value: true,
    description: "Enable caching for dictionary statistics",
    category: "performance",
    type: "boolean" as const,
    defaultValue: true,
    minValue: undefined,
    maxValue: undefined,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "cache-ttl-seconds",
    value: 300,
    description: "Cache time-to-live in seconds for dictionary statistics",
    category: "performance",
    type: "number" as const,
    defaultValue: 300,
    minValue: 60,
    maxValue: 3600,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "rateLimitUpload",
    value: 5,
    description: "Rate limit for file uploads (requests per minute)",
    category: "security" as const,
    type: "number" as const,
    defaultValue: 5,
    minValue: 1,
    maxValue: 50,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "rateLimitAuth",
    value: 10,
    description:
      "Rate limit for authentication endpoints (requests per minute)",
    category: "security" as const,
    type: "number" as const,
    defaultValue: 10,
    minValue: 1,
    maxValue: 30,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
  {
    id: "email-enabled",
    value: true,
    description: "Enable email notifications system",
    category: "general" as const,
    type: "boolean" as const,
    defaultValue: true,
    isReadOnly: false,
    requiresRestart: false,
    updatedAt: new Date(),
  },
];

export async function seedConfig() {
  try {
    console.log("Seeding configuration...");

    for (const configItem of initialConfig) {
      await db
        .insert(config)
        .values(configItem as any)
        .onConflictDoNothing({
          target: config.id,
        });

      console.log(`  ${configItem.id}`);
    }

    console.log("Configuration seeded successfully!");
  } catch (error) {
    console.error("Error seeding config:", error);
    throw error;
  }
}

if (require.main === module) {
  seedConfig().catch((error) => {
    console.error("Config seeding failed:", error);
    process.exit(1);
  });
}
