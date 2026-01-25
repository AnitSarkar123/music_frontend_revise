import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "~/components/providers";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={""}>
      <body className="flex min-h-svh flex-col">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
