"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import { resetPasswordSchema, type ResetPasswordInput } from "../auth.schema"
import { useResetPassword } from "../api/use-auth"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [done, setDone] = useState(false)

  // The token travels in the query string and is never shown or edited — it is
  // a bearer credential, not something the person is meant to read.
  const token = searchParams.get("token") ?? ""

  const form = useZodForm(resetPasswordSchema, {
    defaultValues: { token, password: "", passwordConfirmation: "" },
  })

  const { mutate, isPending } = useResetPassword({
    onSuccess: () => setDone(true),
    onError: (error) => toast.error(error.message),
  })

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Link incomplete</CardTitle>
          <CardDescription>
            This page needs the token from your reset email. Request a new link
            and open it directly.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={PATH.FORGOT_PASSWORD}>Request a new link</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Password changed</CardTitle>
          <CardDescription>
            Every other reset link for this account has been invalidated.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push(PATH.SIGN_IN)}>
            Sign in
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values: ResetPasswordInput) =>
              mutate(values),
            )}
            className="flex flex-col gap-4"
            method="post"
            noValidate
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwordConfirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat the password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Set new password
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
