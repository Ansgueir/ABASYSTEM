"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, ArrowUpRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function SupervisorPaymentsList({ payments }: { payments: any[] }) {
    const [selectedPayment, setSelectedPayment] = useState<string | null>(null)

    return (
        <div className="space-y-3">
            {payments.map((payment) => {
                const isPaid = Number(payment.balanceDue) <= 0
                return (
                    <Dialog key={payment.id} open={selectedPayment === payment.id} onOpenChange={(v) => setSelectedPayment(v ? payment.id : null)}>
                        <DialogTrigger asChild>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Calendar className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">
                                            {format(new Date(payment.monthYear), 'MMMM yyyy')}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Student: {payment.student?.fullName || 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="font-semibold">${Number(payment.amountDue).toFixed(2)}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isPaid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                            {isPaid ? 'PAID' : 'PENDING'}
                                        </span>
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Detail for {format(new Date(payment.monthYear), 'MMMM yyyy')} - {payment.student?.fullName}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {payment.hours && payment.hours.length > 0 ? (
                                    <div className="space-y-3">
                                        {payment.hours.map((hour: any) => (
                                            <div key={hour.id} className="p-4 rounded-xl border bg-muted/20 text-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-semibold">{hour.activityType} <span className="font-normal text-muted-foreground">({hour.supervisionType})</span></p>
                                                        <p className="text-muted-foreground text-xs">
                                                            {hour.setting.replace('_', ' ')} &bull; {new Date(hour.date).toISOString().split('T')[0]} &bull; {new Date(hour.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        {hour.notes && <p className="text-muted-foreground text-xs italic mt-1">&quot;{hour.notes}&quot;</p>}
                                                        {hour.groupTopic && <p className="text-muted-foreground text-xs mt-1">Topic: {hour.groupTopic}</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-medium">${Number(hour.supervisorPay).toFixed(2)}</p>
                                                        <p className="text-muted-foreground text-xs">{Number(hour.hours).toFixed(1)} hrs</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No detailed logs found for this payment.</p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            })}
        </div>
    )
}
