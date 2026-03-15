import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";
import { sendAuthEmail } from "~/lib/auth-email";
// If your Prisma file is located elsewhere, you can change the path

 

export const auth = betterAuth({
    database: prismaAdapter(db, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    emailVerification: {
        sendOnSignUp: false,
        sendOnSignIn: false,
        expiresIn: 120,
        sendVerificationEmail: async ({ user, url }, request) => {
            const requestedMode = request?.headers.get("x-verification-mode");
            const hasLinkMarker = url.includes("verify-method=link");

            if (requestedMode !== "link" && !hasLinkMarker) {
                return;
            }

            await sendAuthEmail({
                to: user.email,
                url,
                type: "verify-email",
                includeLink: true,
                includeOtp: false,
            });
        },
    },
    emailAndPassword:{
        enabled:true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            await sendAuthEmail({
                to: user.email,
                url,
                type: "reset-password",
            });
        },
    }
});