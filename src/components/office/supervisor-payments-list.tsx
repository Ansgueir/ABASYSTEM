"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"

interface SupervisorPaymentsListProps {
    supervisorSummary: Record<string, {
        name: string
        credential: string
        totalProjected: number
        totalPaid: number
        invoices: any[]
    }>
}

export function SupervisorPaymentsList({ supervisorSummary }: SupervisorPaymentsListProps) {
    const [selectedPayout, setSelectedPayout] = useState<any | null>(null)

    const entries = Object.entries(supervisorSummary)

    if (entries.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    No active invoices for supervisors found.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {entries.map(([supId, sup]) => (
                <Card key={supId}>
                    <CardContent className="pt-5">
                        {/* Supervisor Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-base">{sup.name}</h3>
                                <p className="text-xs text-muted-foreground">{sup.credential}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Projected Total for Active Invoices</p>
                                <p className="text-xl font-bold text-primary">${sup.totalProjected.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Invoices Mirror List for Supervisor */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="text-left pb-2 font-medium">Invoice</th>
                                        <th className="text-left pb-2 font-medium">Student</th>
                                        <th className="text-left pb-2 font-medium">Status</th>
                                        <th className="text-right pb-2 font-medium">Bill Total</th>
                                        <th className="text-right pb-2 font-medium text-primary">Your Cap (%)</th>
                                        <th className="text-right pb-2 font-medium text-green-600">Paid to You</th>
                                        <th className="text-right pb-2 font-medium text-amber-600">Rem. Balance</th>
                                        <th className="text-right pb-2 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sup.invoices.map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-muted/50 hover:bg-muted/20">
                                            <td className="py-2 font-mono text-[10px]">#{inv.id.slice(-6).toUpperCase()}</td>
                                            <td className="py-2">{inv.studentName}</td>
                                            <td className="py-2">
                                                <span className="text-[10px] uppercase font-bold border px-1.5 py-0.5 rounded-md">
                                                    {inv.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="py-2 text-right">${inv.invoiceTotal.toFixed(2)}</td>
                                            <td className="py-2 text-right font-medium text-primary">${inv.supervisorCap.toFixed(2)}</td>
                                            <td className="py-2 text-right font-bold text-green-600">${inv.paidAmount.toFixed(2)}</td>
                                            <td className="py-2 text-right font-bold text-amber-600">${inv.remainingCap.toFixed(2)}</td>
                                            <td className="py-2 text-right">
                                                {inv.remainingCap > 0.01 ? (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => setSelectedPayout({ 
                                                            invoiceId: inv.id, 
                                                            supervisorId: supId, 
                                                            supervisorName: sup.name,
                                                            remainingBalance: inv.remainingCap 
                                                        })}
                                                        className="h-6 px-2 text-[10px] bg-primary/90 hover:bg-primary"
                                                    >
                                                        Pay
                                                    </Button>
                                                ) : (
                                                    <span className="text-[10px] text-green-600 font-bold">&#10003; Paid</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Supervisor Payout Modal */}
            {selectedPayout && (
                <SupervisorPayoutModal
                    isOpen={!!selectedPayout}
                    onClose={() => setSelectedPayout(null)}
                    invoiceId={selectedPayout.invoiceId}
                    supervisorId={selectedPayout.supervisorId}
                    supervisorName={selectedPayout.supervisorName}
                    remainingBalance={selectedPayout.remainingBalance}
                />
            )}
        </div>
    )
}
