import type { Metadata } from "next"
import { ContactForm } from "@/features/contact/components/contact-form"
import { ContactSubmissions } from "@/features/contact/components/contact-submissions"

export const metadata: Metadata = { title: "Contact" }

export default function ContactPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <ContactForm />
      <ContactSubmissions />
    </div>
  )
}
