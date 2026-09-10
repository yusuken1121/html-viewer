"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { APP_CONFIG } from "@/constants/app-config"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const

function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // `theme` is only known on the client — render a placeholder until then
  // so the markup matches what the server produced.
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Skeleton className="h-9 w-[76px]" />
  }

  return (
    <div className="flex items-center gap-2">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={theme === value ? "default" : "outline"}
          size="icon"
          aria-label={`Switch to ${label} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how the application looks on your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Enable dark mode for a better viewing experience at night.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{APP_CONFIG.name}</CardTitle>
            <CardDescription>{APP_CONFIG.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Version {APP_CONFIG.version}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
