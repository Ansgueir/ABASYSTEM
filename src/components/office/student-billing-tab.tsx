"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"

export function StudentBillingTab({ invoices = [] }: { invoices: any[] }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground">Loading billing history...</div>
    }

    return (
        <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold text-lg mb-4">Billing History</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-muted-foreground">
                            <th className="text-left font-medium p-3">Date</th>
                            <th className="text-right font-medium p-3">Amount Due</th>
                            <th className="text-right font-medium p-3">Amount Paid</th>
                            <th className="text-right font-medium p-3">Status</th>
                            <th className="text-right font-medium p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    No billing history available.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((invoice: any) => {
                                const invoiceDate = invoice?.createdAt || invoice?.invoiceDate ? new Date(invoice.createdAt || invoice.invoiceDate) : null;
                                const isValidInvoiceDate = invoiceDate && !isNaN(invoiceDate.getTime());

                                return (
                                    <tr key={invoice.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="p-3">
                                            {isValidInvoiceDate ? format(invoiceDate!, "MMM d, yyyy") : "N/A"}
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                            ${Number(invoice.amountDue || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right text-muted-foreground">
                                            ${Number(invoice.amountPaid || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <Badge variant={invoice.status === 'PAID' ? 'default' : 'secondary'}>
                                                {String(invoice.status || "UNKNOWN")}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                                                <a href={`/api/office/invoices/${invoice.id}/download`} target="_blank">
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                </a>
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
