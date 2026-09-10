import type { Metadata } from "next"
import { ContactForm } from "@/features/contact/components/contact-form"
import { ContactSubmissions } from "@/features/contact/components/contact-submissions"
import { getCurrentUser } from "@/features/auth/session"

export const metadata: Metadata = { title: "Contact" }

export default async function ContactPage() {
  // The page is public, so the list is rendered only for an admin. The route
  // that serves it checks the role again — hiding a component is presentation,
  // not authorization.
  const user = await getCurrentUser()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <ContactForm />
      {user?.role === "admin" && <ContactSubmissions />}
    </div>
  )
}
