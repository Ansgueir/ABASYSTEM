/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, Check, X } from "lucide-react"

export function ImportStaging() {
    const [file, setFile] = useState<File | null>(null)
    const [isStaging, setIsStaging] = useState(false)
    const [isCommitting, setIsCommitting] = useState(false)
    
    // We will store the parsed conflicts and missing entries here
    const [stagingResult, setStagingResult] = useState<any>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setStagingResult(null) // reset
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setIsStaging(true)
        setStagingResult(null)

        const formData = new FormData()
        formData.append("file", file)
        formData.append("action", "stage")

        try {
            const res = await fetch("/api/office/vault/import", {
                method: "POST",
                body: formData
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || "Error processing file")
            }

            const data = await res.json()
            setStagingResult({
                ...data,
                // Initialize resolution choices for conflicts
                resolutions: data.conflicts?.reduce((acc: any, c: any) => {
                    acc[c.id] = "ignore" // Default is to ignore DB changes
                    return acc
                }, {}) || {}
            })

        } catch (error: any) {
            alert(error.message)
        } finally {
            setIsStaging(false)
        }
    }

    const setResolution = (id: string, choice: "sum" | "replace" | "ignore") => {
        setStagingResult((prev: any) => ({
            ...prev,
            resolutions: {
                ...prev.resolutions,
                [id]: choice
            }
        }))
    }

    const setGlobalResolution = (choice: "sum" | "replace" | "ignore") => {
        const newRes = { ...stagingResult.resolutions }
        Object.keys(newRes).forEach(k => {
            newRes[k] = choice
        })
        setStagingResult((prev: any) => ({ ...prev, resolutions: newRes }))
    }

    const handleCommit = async () => {
        setIsCommitting(true)
        
        try {
            // We only need to send back the chosen resolutions and the original filename (or ideally the staging token, but we'll send the file again for atomic parsing)
            // Wait, if we send the file again, it has to parse from scratch.
            // Better to send the full resolved JSON payload directly to the API to commit it.
            
            const payload = {
                action: "commit",
                data: stagingResult.validData,
                newUsers: stagingResult.newUsers,
                resolutions: stagingResult.resolutions,
                conflicts: stagingResult.conflicts
            }

            const res = await fetch("/api/office/vault/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text)
            }

            alert("Importación completada y confirmada con éxito.")
            setFile(null)
            setStagingResult(null)
            
            // Optionally reload to update history
            window.location.reload()

        } catch (error: any) {
            alert(`Error confirming import: ${error.message}`)
        } finally {
            setIsCommitting(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UploadCloud className="h-5 w-5" />
                        Massive Data Import Engine
                    </CardTitle>
                    <CardDescription>
                        Upload the exported .xlsx master file. You will be able to review and resolve any financial conflicts before injecting the data into the database.
                        New users will be flagged to require the setup wizard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="import-excel">Master Export Excel (.xlsx)</Label>
                            <Input id="import-excel" type="file" accept=".xlsx" onChange={handleFileChange} />
                        </div>
                        <Button onClick={handleUpload} disabled={!file || isStaging}>
                            {isStaging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                            Run Staging Phase
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {stagingResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid md:grid-cols-3 gap-4">
                        <Card className="bg-blue-50/50 border-blue-200">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-blue-700">{stagingResult.skippedRowsCount || 0}</span>
                                <span className="text-sm font-medium text-blue-600">Rows Ignored (Pre-2026)</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50/50 border-green-200">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-green-700">{stagingResult.newUsers?.length || 0}</span>
                                <span className="text-sm font-medium text-green-600">New Users to create</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50/50 border-amber-200">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-amber-700">{stagingResult.conflicts?.length || 0}</span>
                                <span className="text-sm font-medium text-amber-600">Financial Conflicts Detected</span>
                            </CardContent>
                        </Card>
                    </div>

                    {stagingResult.conflicts?.length > 0 && (
                        <Card className="border-amber-200 shadow-sm border-2">
                            <CardHeader className="bg-amber-50">
                                <CardTitle className="text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Financial Conflict Resolution
                                </CardTitle>
                                <CardDescription className="text-amber-700/80">
                                    The following records have differing amounts between the database and the uploaded Excel file. Choose an action for each.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-4 border-b flex items-center justify-between bg-white">
                                    <span className="text-sm font-medium">Global Action:</span>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setGlobalResolution("sum")}>[Sumar] a Todos</Button>
                                        <Button size="sm" variant="outline" onClick={() => setGlobalResolution("replace")}>[Reemplazar] Todos</Button>
                                        <Button size="sm" variant="outline" onClick={() => setGlobalResolution("ignore")}>[Ignorar] Todos</Button>
                                    </div>
                                </div>
                                <div className="divide-y max-h-[400px] overflow-y-auto bg-white">
                                    {stagingResult.conflicts.map((conflict: any) => (
                                        <div key={conflict.id} className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-sm">{conflict.studentName} <span className="text-muted-foreground font-normal">({conflict.type})</span></p>
                                                <p className="text-xs text-muted-foreground">Period {conflict.periodNumber} • {conflict.month}</p>
                                                <div className="flex gap-6 mt-2">
                                                    <div>
                                                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Current DB Amount</span>
                                                        <p className="font-mono text-sm">${conflict.dbAmount}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Excel Amount</span>
                                                        <p className="font-mono text-sm">${conflict.excelAmount}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 bg-slate-50 p-2 rounded-lg border">
                                                <Button 
                                                    size="sm" 
                                                    variant={stagingResult.resolutions[conflict.id] === "sum" ? "default" : "ghost"}
                                                    onClick={() => setResolution(conflict.id, "sum")}
                                                >
                                                    Sumar <span className="ml-1 opacity-70">(${Number(conflict.dbAmount || 0) + Number(conflict.excelAmount || 0)})</span>
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant={stagingResult.resolutions[conflict.id] === "replace" ? "default" : "ghost"}
                                                    onClick={() => setResolution(conflict.id, "replace")}
                                                >
                                                    Reemplazar
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant={stagingResult.resolutions[conflict.id] === "ignore" ? "default" : "ghost"}
                                                    onClick={() => setResolution(conflict.id, "ignore")}
                                                >
                                                    Ignorar (DB)
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setStagingResult(null)} disabled={isCommitting}>
                            Cancel
                        </Button>
                        <Button variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleCommit} disabled={isCommitting}>
                            {isCommitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Confirm Atomic Injection (Commit)
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
