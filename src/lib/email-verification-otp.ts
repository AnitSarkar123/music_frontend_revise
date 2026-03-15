import { createHash, randomInt, randomUUID } from "node:crypto";
import { env } from "~/env";
import { db } from "~/server/db";

const EMAIL_VERIFICATION_OTP_PREFIX = "email-verification-otp:";
const OTP_EXPIRES_IN_MS = 2 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getIdentifier(email: string) {
  return `${EMAIL_VERIFICATION_OTP_PREFIX}${normalizeEmail(email)}`;
}

function hashOtp(email: string, otp: string) {
  return createHash("sha256")
    .update(`${normalizeEmail(email)}:${otp}:${env.BETTER_AUTH_SECRET}`)
    .digest("hex");
}

function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export async function issueEmailVerificationOtp(email: string) {
  const otp = generateOtp();
  const now = new Date();
  const identifier = getIdentifier(email);

  await db.verification.deleteMany({
    where: {
      identifier,
    },
  });

  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier,
      value: hashOtp(email, otp),
      expiresAt: new Date(now.getTime() + OTP_EXPIRES_IN_MS),
      createdAt: now,
      updatedAt: now,
    },
  });

  return otp;
}

export async function consumeEmailVerificationOtp(email: string, otp: string) {
  const identifier = getIdentifier(email);

  const record = await db.verification.findFirst({
    where: {
      identifier,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    return false;
  }

  const otpHash = hashOtp(email, otp);

  if (record.value !== otpHash) {
    return false;
  }

  await db.verification.deleteMany({
    where: {
      identifier,
    },
  });

  return true;
}
