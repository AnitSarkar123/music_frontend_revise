import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeEmailVerificationOtp } from "~/lib/email-verification-otp";
import { db } from "~/server/db";

const VerifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = VerifyEmailOtpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      emailVerified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid email or OTP" }, { status: 400 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, message: "Email already verified" });
  }

  const isValid = await consumeEmailVerificationOtp(normalizedEmail, parsed.data.otp);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid email or OTP" }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  return NextResponse.json({ success: true, message: "Email verified successfully" });
}
