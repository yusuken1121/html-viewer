import type { Metadata } from "next"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function Page() {
  // Suspense boundary: the form reads searchParams / router state, which
  // opts it into client-side rendering.
  return (
    <Suspense fallback={<Skeleton className="h-[26rem] w-full max-w-sm" />}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
