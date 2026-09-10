"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Mail } from "lucide-react"

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
import { forgotPasswordSchema, type ForgotPasswordInput } from "../auth.schema"
import { useRequestPasswordReset } from "../api/use-auth"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const form = useZodForm(forgotPasswordSchema, {
    defaultValues: { email: "" },
  })

  const { mutate, isPending } = useRequestPasswordReset({
    // Success either way: the server does not reveal whether the address is
    // registered, and neither does this screen.
    onSettled: () => setSent(true),
  })

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            If that address has an account, a reset link is on its way. The link
            expires in one hour.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={PATH.SIGN_IN}>Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          We will email you a link to choose a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values: ForgotPasswordInput) =>
              mutate(values),
            )}
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

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send reset link
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href={PATH.SIGN_IN} className="font-medium underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
