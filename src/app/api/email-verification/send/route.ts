import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "~/lib/auth";
import { sendAuthEmail } from "~/lib/auth-email";
import { issueEmailVerificationOtp } from "~/lib/email-verification-otp";
import { db } from "~/server/db";

const SendVerificationSchema = z.object({
  email: z.string().email(),
  method: z.enum(["link", "otp"]),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = SendVerificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, message: "Email already verified" });
  }

  const callbackURL = "/auth/sign-in?verify-method=link";

  if (parsed.data.method === "link") {
    await auth.api.sendVerificationEmail({
      body: {
        email: user.email,
        callbackURL,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Verification link sent",
    });
  }

  const otpCode = await issueEmailVerificationOtp(user.email);

  await sendAuthEmail({
    to: user.email,
    url: `${process.env.BETTER_AUTH_URL ?? ""}/auth/sign-in`,
    type: "verify-email",
    otpCode,
    includeLink: false,
    includeOtp: true,
  });

  return NextResponse.json({
    success: true,
    message: "Verification OTP sent",
  });
}
