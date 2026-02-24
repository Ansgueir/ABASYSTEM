"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { format } from "date-fns"

export function ExportPaymentsButton({ payments }: { payments: any[] }) {
    return (
        <a href="/api/supervisor/payments/export" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="rounded-xl">
                <Download className="h-4 w-4 mr-2" />
                Export
            </Button>
        </a>
    )
}
