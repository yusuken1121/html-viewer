"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PATH } from "@/constants/path"
import { useZodForm } from "@/hooks/use-zod-form"
import { credentialsSchema, type CredentialsInput } from "../auth.schema"

const EMPTY_FORM: CredentialsInput = { email: "", password: "" }

export function SignInForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useZodForm(credentialsSchema, { defaultValues: EMPTY_FORM })

  /**
   * `redirect: false` so a failed sign-in stays on this page and can show the
   * message inline, instead of bouncing through Auth.js' own error page.
   */
  const onSubmit = async (values: CredentialsInput) => {
    setError(null)
    setIsPending(true)

    const result = await signIn("credentials", { ...values, redirect: false })

    setIsPending(false)

    if (!result || result.error) {
      setError("Incorrect email or password.")
      return
    }

    /**
     * A full document load, not `router.push`.
     *
     * The session only exists once the cookie is set, and every Server
     * Component above this point rendered while it was absent. A client-side
     * push reuses that cached signed-out tree, and pairing it with
     * `router.refresh()` races: the refresh aborts the pending navigation and
     * the browser stays on the sign-in page with a valid session.
     *
     * Signing in is exactly the moment a fresh render is worth a page load.
     */
    window.location.assign(searchParams.get("callbackUrl") ?? PATH.HOME)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use the account created by{" "}
          <code className="font-mono">pnpm db:seed</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/*
            method="post" matters even though onSubmit preventDefaults: if the
            JS chunk fails to load, the browser falls back to a native submit,
            and the default GET puts the password in the URL and the history.
          */}
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            method="post"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <Link href={PATH.FORGOT_PASSWORD} className="font-medium underline">
          Forgot your password?
        </Link>
        <span>
          No account?
          <Link href={PATH.SIGN_UP} className="ml-1 font-medium underline">
            Create one
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
