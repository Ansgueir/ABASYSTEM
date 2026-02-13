"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
        indicatorClassName?: string
    }
>(({ className, value, indicatorClassName, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            "relative h-3 w-full overflow-hidden rounded-full bg-secondary",
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className={cn(
                "h-full w-full flex-1 rounded-full gradient-primary transition-all duration-500 ease-out",
                indicatorClassName
            )}
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

// Componente de progreso circular para estadísticas
interface CircularProgressProps {
    value: number
    size?: number
    strokeWidth?: number
    className?: string
    children?: React.ReactNode
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
    ({ value, size = 120, strokeWidth = 10, className, children }, ref) => {
        const radius = (size - strokeWidth) / 2
        const circumference = radius * 2 * Math.PI
        const offset = circumference - (value / 100) * circumference

        return (
            <div ref={ref} className={cn("relative inline-flex items-center justify-center", className)}>
                <svg width={size} height={size} className="transform -rotate-90">
                    {/* Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="hsl(var(--secondary))"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="url(#progress-gradient)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-700 ease-out"
                    />
                    <defs>
                        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="hsl(252, 85%, 60%)" />
                            <stop offset="100%" stopColor="hsl(252, 60%, 75%)" />
                        </linearGradient>
                    </defs>
                </svg>
                {children && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {children}
                    </div>
                )}
            </div>
        )
    }
)
CircularProgress.displayName = "CircularProgress"

export { Progress, CircularProgress }
