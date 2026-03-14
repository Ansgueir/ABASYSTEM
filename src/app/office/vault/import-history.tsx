"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, Undo, Loader2 } from "lucide-react"
import { format } from "date-fns"

export function ImportHistory() {
    const [history, setHistory] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [undoingMap, setUndoingMap] = useState<Record<string, boolean>>({})

    const fetchHistory = async () => {
        try {
            const res = await fetch("/api/office/vault/import/history")
            if (res.ok) {
                const data = await res.json()
                setHistory(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    const handleUndo = async (batchId: string) => {
        if (!confirm("Are you sure you want to undo this import? This will revert updated fields and soft-delete new users.")) return

        setUndoingMap(prev => ({ ...prev, [batchId]: true }))
        try {
            const res = await fetch(`/api/office/vault/import/undo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId })
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text)
            }

            alert("Undo successful!")
            await fetchHistory()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        } finally {
            setUndoingMap(prev => ({ ...prev, [batchId]: false }))
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Import History & Rollbacks
                </CardTitle>
                <CardDescription>
                    All massive imports are logged here. You can selectively undo any batch to reverse its effects atomicaly.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
                        No import batches found.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map(batch => (
                            <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-slate-50 relative overflow-hidden">
                                {batch.revertedAt && (
                                    <div className="absolute top-0 right-0 px-2 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-bl-lg">
                                        REVERTED
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-sm tracking-tight">{batch.batchString}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {(() => {
                                            try {
                                                return format(new Date(batch.createdAt), "PPP p")
                                            } catch (e) {
                                                return "Invalid Date"
                                            }
                                        })()} • {batch.logs?.length || 0} affected records
                                    </p>
                                </div>
                                <div className="mt-4 sm:mt-0 flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                                        size="sm"
                                        onClick={() => handleUndo(batch.id)}
                                        disabled={!!batch.revertedAt || undoingMap[batch.id]}
                                    >
                                        {undoingMap[batch.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo className="h-4 w-4 mr-2" />}
                                        Undo Import
                                    </Button>

                                    <Button 
                                        variant="ghost"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                                        size="sm"
                                        onClick={async () => {
                                            if (!confirm("§7 HARD DELETE POLICY: ¿Estás seguro de eliminar permanentemente este lote de la memoria? Esto destruirá la capacidad de revertirlo. No se eliminarán los datos ya inyectados, solo el log de auditoría.")) return
                                            try {
                                                const res = await fetch("/api/office/vault/import/delete-batch", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ batchId: batch.id })
                                                })
                                                if (res.ok) {
                                                    alert("Batch log deleted forever.")
                                                    await fetchHistory()
                                                }
                                            } catch (e) {
                                                console.error(e)
                                            }
                                        }}
                                    >
                                        Delete Batch Log
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
