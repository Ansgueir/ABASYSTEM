import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-base",
                    "transition-all duration-200",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                    "md:text-sm",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
