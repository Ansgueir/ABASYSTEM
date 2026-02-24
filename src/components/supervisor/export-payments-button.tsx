"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { format } from "date-fns"

export function ExportPaymentsButton({ payments }: { payments: any[] }) {
    const handleExport = () => {
        const headers = ["Month", "Student", "Amount Due ($)", "Amount Paid ($)", "Balance Due ($)", "Status"]
        const csvContent = [
            headers.join(","),
            ...payments.map(p => {
                const month = format(new Date(p.monthYear), 'MMMM yyyy')
                const student = `"${p.student?.fullName || 'Unknown'}"`
                const amountDue = Number(p.amountDue).toFixed(2)
                const amountPaid = (Number(p.amountAlreadyPaid) + Number(p.amountPaidThisMonth)).toFixed(2)
                const balanceDue = Number(p.balanceDue).toFixed(2)
                const status = Number(p.balanceDue) <= 0 ? 'PAID' : 'PENDING'
                return [month, student, amountDue, amountPaid, balanceDue, status].join(",")
            })
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `supervisor-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
        </Button>
    )
}
