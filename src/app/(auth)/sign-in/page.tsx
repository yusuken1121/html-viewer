import type { Metadata } from "next"
import { Suspense } from "react"
import { SignInForm } from "@/features/auth/components/sign-in-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[26rem] w-full max-w-sm" />}>
      <SignInForm />
    </Suspense>
  )
}
