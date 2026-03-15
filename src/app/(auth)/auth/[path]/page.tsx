import { AuthView } from "@daveyplate/better-auth-ui"
import { authViewPaths } from "@daveyplate/better-auth-ui/server"
import { SignupWithMethodForm } from "~/components/auth/signup-with-method-form"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
    const { path } = await params

    if (path === "sign-up") {
        return (
            <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
                <SignupWithMethodForm />
            </main>
        )
    }

    return (
        <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
            <AuthView path={path} />
        </main>
    )
}