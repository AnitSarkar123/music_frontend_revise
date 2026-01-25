import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   */
  server: {
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MODAL_KEY: z.string(),
    MODAL_SECRET: z.string(),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string(),
    CLOUDINARY_API_KEY: z.string(),
    CLOUDINARY_API_SECRET: z.string(),

    // Storage provider
    STORAGE_PROVIDER: z.string().default("cloudinary"),

    // Optional AWS (leave optional if not using S3)
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),

    // Backend endpoints (expect full URLs)
    GENERATE_FROM_DESCRIPTION: z.string().url(),
    GENERATE_FROM_DESCRIBED_LYRICS: z.string().url(),
    GENERATE_WITH_LYRICS: z.string().url(),

    // Optional external tokens
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
  },

  /**
   * Client-side environment variables (none exposed)
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * Runtime mapping
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    MODAL_KEY: process.env.MODAL_KEY,
    MODAL_SECRET: process.env.MODAL_SECRET,

    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,

    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY_ID: process.env.AWS_SECRET_ACCESS_KEY_ID,
    AWS_REGION: process.env.AWS_REGION,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,

    GENERATE_FROM_DESCRIPTION: process.env.GENERATE_FROM_DESCRIPTION,
    GENERATE_FROM_DESCRIBED_LYRICS: process.env.GENERATE_FROM_DESCRIBED_LYRICS,
    GENERATE_WITH_LYRICS: process.env.GENERATE_WITH_LYRICS,

    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});