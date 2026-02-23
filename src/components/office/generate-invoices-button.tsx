"use client"

import { Button } from "@/components/ui/button"
import { Play, Loader2 } from "lucide-react"
import { generateInvoicesAction } from "@/actions/billing"
import { useState } from "react"
import { toast } from "sonner" // Assuming sonner is installed or use minimal alert

export function GenerateInvoicesButton() {
    const [loading, setLoading] = useState(false)

    async function handleGenerate() {
        setLoading(true)
        try {
            const result = await generateInvoicesAction()
            if (result.success) {
                if (result.count === 0) {
                    toast.info("No approved logs found ready to invoice.")
                } else {
                    toast.success(`Invoicing complete! Generated ${result.count} invoice(s).`)
                }
            } else {
                toast.error(result.error || "Failed to generate invoices")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            className="rounded-xl"
            onClick={handleGenerate}
            disabled={loading}
        >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run Invoicing
        </Button>
    )
}
