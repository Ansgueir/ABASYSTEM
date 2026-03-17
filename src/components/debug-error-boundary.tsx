
"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class DebugErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 border-2 border-dashed border-destructive/50 rounded-xl bg-destructive/5 text-destructive">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6" />
            <h2 className="text-lg font-bold">{this.props.title || "Rendering Error Detected"}</h2>
          </div>
          <p className="font-mono text-sm bg-destructive/10 p-4 rounded border border-destructive/20 mb-4 whitespace-pre-wrap">
            {this.state.error?.message}
          </p>
          <p className="text-sm text-muted-foreground">
            This error usually happens when trying to render an object directly in JSX.
            Check the console for more details.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
