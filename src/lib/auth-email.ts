import { env } from "~/env";

type AuthEmailType = "verify-email" | "reset-password";

type SendAuthEmailInput = {
  to: string;
  url: string;
  type: AuthEmailType;
  otpCode?: string;
  includeLink?: boolean;
  includeOtp?: boolean;
};

export async function sendAuthEmail({
  to,
  url,
  type,
  otpCode,
  includeLink,
  includeOtp,
}: SendAuthEmailInput) {
  const resolvedIncludeLink = type === "verify-email" ? (includeLink ?? true) : true;
  const resolvedIncludeOtp = type === "verify-email" ? (includeOtp ?? false) : false;

  const subject =
    type === "verify-email" ? "Verify your email" : "Reset your password";

  const actionText =
    type === "verify-email" ? "Verify Email" : "Reset Password";

  const intro =
    type === "verify-email"
      ? "Please verify your email address using the method you selected."
      : "You requested a password reset. Click the button below to set a new password.";

  const otpText =
    type === "verify-email" && resolvedIncludeOtp && otpCode
      ? `\n\nYour 6-digit OTP is: ${otpCode}`
      : "";

  const linkText = resolvedIncludeLink ? `\n\nVerification link: ${url}` : "";

  const text = `${intro}${linkText}${otpText}\n\nIf you did not request this, you can ignore this email.`;

  const otpHtml =
    type === "verify-email" && resolvedIncludeOtp && otpCode
      ? `
      <p>Your 6-digit OTP code:</p>
      <p style="font-size:22px;font-weight:700;letter-spacing:3px;margin:8px 0;">${otpCode}</p>
      <p>Enter this code in the OTP verification screen in the app.</p>
      `
      : "";

  const linkHtml = resolvedIncludeLink
    ? `
      <p>
        <a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
          ${actionText}
        </a>
      </p>
      <p>If the button doesn't work, use this link:</p>
      <p><a href="${url}">${url}</a></p>
    `
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <p>${intro}</p>
      ${linkHtml}
      ${otpHtml}
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const resendApiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;

  if (!resendApiKey || !from) {
    if (env.NODE_ENV === "production") {
      throw new Error("Auth email provider is not configured.");
    }

    console.log(`[AUTH EMAIL DEV] ${type} -> ${to}`);
    console.log(`[AUTH EMAIL DEV LINK] ${url}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send auth email: ${errorText}`);
  }
}
