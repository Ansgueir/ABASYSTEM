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
            const res = await fetch(`/api/office/vault/import/rollback`, {
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
                    <History className="h-5 w-5 text-indigo-600" />
                    Data Snapshots & Rollback History
                </CardTitle>
                <CardDescription>
                    Cada importación masiva genera un snapshot. Puedes realizar un Rollback atómico para revertir cambios o eliminar el snapshot de la memoria si ya no lo necesitas.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-xl border-slate-100">
                        No se han encontrado snapshots de importación.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map(batch => (
                            <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-slate-50 relative overflow-hidden transition-all hover:border-slate-300">
                                {batch.revertedAt && (
                                    <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[10px] font-black tracking-tighter uppercase rounded-bl-lg">
                                        REVERTED / ROLLBACK DONE
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-sm tracking-tight text-slate-800">{batch.batchString}</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        {(() => {
                                            try {
                                                return format(new Date(batch.createdAt), "PPP p")
                                            } catch (e) {
                                                return "Invalid Date"
                                            }
                                        })()} • {batch.logs?.length || 0} registros afectados
                                    </p>
                                </div>
                                <div className="mt-4 sm:mt-0 flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors h-8"
                                        size="sm"
                                        onClick={() => handleUndo(batch.id)}
                                        disabled={!!batch.revertedAt || undoingMap[batch.id]}
                                    >
                                        {undoingMap[batch.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo className="h-4 w-4 mr-2" />}
                                        Execute Rollback
                                    </Button>

                                    <Button 
                                        variant="ghost"
                                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors h-8"
                                        size="sm"
                                        onClick={async () => {
                                            if (!confirm("§7 HARD DELETE: ¿Estás seguro de eliminar este snapshot de la memoria? Perderás la capacidad de revertirlo en el futuro.")) return
                                            try {
                                                const res = await fetch("/api/office/vault/import/delete-batch", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ batchId: batch.id })
                                                })
                                                if (res.ok) {
                                                    alert("Snapshot eliminado de la memoria.")
                                                    await fetchHistory()
                                                }
                                            } catch (e) {
                                                console.error(e)
                                            }
                                        }}
                                    >
                                        Delete Snapshot Memory
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
