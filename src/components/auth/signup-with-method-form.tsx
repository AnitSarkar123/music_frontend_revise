"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

type VerificationMethod = "link" | "otp";

export function SignupWithMethodForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("link");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const signUpResponse = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          callbackURL: "/auth/sign-in",
        }),
      });

      const signUpData = (await signUpResponse.json().catch(() => ({}))) as {
        message?: string;
        error?: { message?: string };
      };

      if (!signUpResponse.ok) {
        toast.error(
          signUpData?.error?.message ?? signUpData?.message ?? "Sign up failed.",
        );
        return;
      }

      const verificationResponse = await fetch("/api/email-verification/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          method,
        }),
      });

      const verificationData = (await verificationResponse.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!verificationResponse.ok) {
        toast.error(verificationData.error ?? "Failed to send verification email.");
        return;
      }

      if (method === "otp") {
        toast.success("OTP sent to your email.");
        router.push(`/email-verify-otp?email=${encodeURIComponent(email)}`);
      } else {
        toast.success("Verification link sent to your email.");
        router.push("/auth/sign-in");
      }

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
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Choose how you want to verify your email right after signup.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Email verification method</Label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="verificationMethod"
                  value="link"
                  checked={method === "link"}
                  onChange={() => setMethod("link")}
                />
                Verification Link
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="verificationMethod"
                  value="otp"
                  checked={method === "otp"}
                  onChange={() => setMethod("otp")}
                />
                OTP Code
              </label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign up"}
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            Already have an account? <Link href="/auth/sign-in" className="underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
