import type { Metadata } from "next"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SignUpForm } from "@/features/auth/components/sign-up-form"

export const metadata: Metadata = { title: "Sign up" }

export default function Page() {
  // Suspense boundary: the form reads searchParams / router state, which
  // opts it into client-side rendering.
  return (
    <Suspense fallback={<Skeleton className="h-[26rem] w-full max-w-sm" />}>
      <SignUpForm />
    </Suspense>
  )
}
