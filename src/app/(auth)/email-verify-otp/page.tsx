import { VerifyEmailOtpForm } from "~/components/auth/verify-email-otp-form";

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function EmailVerifyOtpPage({ searchParams }: PageProps) {
  const { email } = await searchParams;

  return (
    <main className="container flex grow flex-col items-center justify-center p-4 md:p-6">
      <VerifyEmailOtpForm initialEmail={email ?? ""} />
    </main>
  );
}
