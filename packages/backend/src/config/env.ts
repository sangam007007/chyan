import { config } from "dotenv";
import { z } from "zod";

// Load .env file (looks in cwd, then parent directories)
config();
config({ path: "../../.env" });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database (PostgreSQL 16)
  DB_URL: z
    .string()
    .url("DB_URL must be a valid PostgreSQL connection string")
    .startsWith("postgresql://", "DB_URL must use postgresql:// protocol"),

  // Cache (Redis 7)
  REDIS_URL: z
    .string()
    .url("REDIS_URL must be a valid Redis connection string")
    .regex(/^rediss?:\/\//, "REDIS_URL must use redis:// or rediss:// protocol"),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  // SMS Gateway
  SMS_API_KEY: z.string().min(1, "SMS_API_KEY is required"),
  SMS_API_URL: z
    .string()
    .url("SMS_API_URL must be a valid URL")
    .optional()
    .default("https://api.sms-provider.com/send"),

  // Google OAuth 2.0
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url("GOOGLE_CALLBACK_URL must be a valid URL")
    .optional()
    .default("http://localhost:4000/api/auth/google/callback"),

  // CAPTCHA
  CAPTCHA_SECRET: z.string().min(1, "CAPTCHA_SECRET is required"),

  // CORS
  CORS_ORIGIN: z
    .string()
    .optional()
    .default("http://localhost:5173"),

  // File storage
  UPLOAD_DIR: z.string().optional().default("./uploads"),
  MAX_AVATAR_SIZE_MB: z.coerce.number().optional().default(2),

  // Rank Estimator
  RANK_TOTAL_APPLICANTS: z.coerce.number().int().positive(),
  RANK_TOTAL_MARKS: z.coerce.number().positive().default(150),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error("❌ Environment validation failed:\n" + formatted);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
