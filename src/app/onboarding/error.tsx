"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { AlertCircle, RefreshCcw } from "lucide-react"

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console for debugging in production
    console.error("Onboarding Error Boundary caught:", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full shadow-lg border-t-4 border-destructive">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Something went wrong</CardTitle>
          <CardDescription>
            We encountered an error during the onboarding process.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Don't worry, your progress so far has likely been saved. Please try refreshing the page or clicking the button below to retry.
          </p>
          {process.env.NODE_ENV === "development" && (
            <div className="bg-red-50 p-4 rounded text-xs text-red-800 text-left overflow-auto max-h-40">
              <p className="font-mono">{error.message}</p>
              {error.stack && <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={() => reset()} className="w-full flex items-center justify-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
            Refresh Full Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
