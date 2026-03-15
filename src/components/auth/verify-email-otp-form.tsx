"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type VerifyEmailOtpFormProps = {
  initialEmail?: string;
};

export function VerifyEmailOtpForm({ initialEmail = "" }: VerifyEmailOtpFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isResendingLink, setIsResendingLink] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);

  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  const resendVerification = async (method: "otp" | "link") => {
    if (!email.trim()) {
      toast.error("Please enter your email first.");
      return;
    }

    if (method === "otp") setIsResendingOtp(true);
    else setIsResendingLink(true);

    try {
      const response = await fetch("/api/email-verification/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, method }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Failed to resend verification.");
        return;
      }

      toast.success(
        data.message ?? (method === "otp" ? "OTP resent." : "Verification link resent."),
      );

      if (method === "otp") {
        setSecondsRemaining(120);
      }
    } catch {
      toast.error("Something went wrong while resending verification.");
    } finally {
      if (method === "otp") setIsResendingOtp(false);
      else setIsResendingLink(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || otp.length !== 6) {
      toast.error("Please enter email and 6-digit OTP.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/email-verification/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Failed to verify OTP.");
        return;
      }

      toast.success(data.message ?? "Email verified successfully.");
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verify Email with OTP</CardTitle>
        <CardDescription>
          Enter your OTP here. If verification failed, you can resend OTP or resend verification link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">6-digit OTP</Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
            />
            <p className="text-muted-foreground text-xs">
              {secondsRemaining > 0
                ? `${secondsRemaining} seconds remaining`
                : "OTP expired. Please resend OTP."}
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Verify with OTP"}
          </Button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => resendVerification("otp")}
              disabled={isResendingOtp || isResendingLink}
            >
              {isResendingOtp ? "Resending OTP..." : "Resend OTP"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => resendVerification("link")}
              disabled={isResendingOtp || isResendingLink}
            >
              {isResendingLink ? "Resending Link..." : "Resend Link"}
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            Already verified by URL? <Link href="/auth/sign-in" className="underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
