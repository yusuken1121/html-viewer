import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center p-6 animate-in fade-in duration-700">
      <div className="relative">
        <h1 className="text-[12rem] font-bold leading-none tracking-tighter text-muted-foreground/10 select-none">
          404
        </h1>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
          <h2 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-sm max-w-[400px] mx-auto">
            The page you&apos;re looking for seems to have drifted into the
            digital void.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <Button
          asChild
          variant="outline"
          className="group rounded-full px-6 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
        >
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  )
}
