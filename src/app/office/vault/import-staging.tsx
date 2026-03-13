/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    UploadCloud, Loader2, AlertTriangle, FileSpreadsheet,
    Check, X, ChevronDown, ChevronUp, Download
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface IgnoredRow { rowNumber: number; name: string; reason: string }
interface HeadlessUser { name: string; rowNumber: number; email: string; collisionType: string; collisionDetail: string }
interface StagingResult {
    ignoredRows: IgnoredRow[]
    skippedRowsCount: number
    studentsDetected: number
    supervisorsDetected: number
    newUsers: any[]
    newSupervisors: any[]
    conflicts: any[]
    headlessUsers: HeadlessUser[]
    mergedRecords: any[]
    newFinancialPeriods: any[]
    supervisorUpdates: any[]
    validData: any
    resolutions: Record<string, "sum" | "replace" | "ignore">
}

// Collision badge color map
const collisionBadge: Record<string, { label: string; className: string }> = {
    EMAIL_EMPTY:            { label: "Email Vacío",                   className: "bg-gray-100 text-gray-600 border-gray-300" },
    EMAIL_IN_DB:            { label: "Email ya existe en BD",         className: "bg-red-100 text-red-700 border-red-300" },
    EMAIL_DUPLICATE_IN_FILE: { label: "Email duplicado en Excel",     className: "bg-orange-100 text-orange-700 border-orange-300" },
}

export function ImportStaging() {
    const [file, setFile] = useState<File | null>(null)
    const [isStaging, setIsStaging] = useState(false)
    const [isCommitting, setIsCommitting] = useState(false)
    const [stagingResult, setStagingResult] = useState<StagingResult | null>(null)

    // Collapsible panel state
    const [showIgnored, setShowIgnored] = useState(false)
    const [showHeadless, setShowHeadless] = useState(true)
    const [showMerged,   setShowMerged]   = useState(true)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0])
            setStagingResult(null)
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
            const res = await fetch("/api/office/vault/import", { method: "POST", body: formData })
            if (!res.ok) throw new Error(await res.text() || "Error processing file")
            const data = await res.json()
            setStagingResult({
                ...data,
                resolutions: data.conflicts?.reduce((acc: any, c: any) => {
                    acc[c.id] = "ignore"
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
        setStagingResult((prev: any) => ({ ...prev, resolutions: { ...prev.resolutions, [id]: choice } }))
    }

    const setGlobalResolution = (choice: "sum" | "replace" | "ignore") => {
        const newRes = { ...stagingResult!.resolutions }
        Object.keys(newRes).forEach(k => { newRes[k] = choice })
        setStagingResult((prev: any) => ({ ...prev, resolutions: newRes }))
    }

    const handleCommit = async () => {
        setIsCommitting(true)
        try {
            const payload = {
                action: "commit",
                data: stagingResult!.validData,
                newUsers: stagingResult!.newUsers,
                newSupervisors: stagingResult!.newSupervisors,
                supervisorUpdates: stagingResult!.supervisorUpdates,
                resolutions: stagingResult!.resolutions,
                conflicts: stagingResult!.conflicts,
                newFinancialPeriods: stagingResult!.newFinancialPeriods
            }

            const res = await fetch("/api/office/vault/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error(await res.text())

            alert("Importación completada y confirmada con éxito.")
            setFile(null)
            setStagingResult(null)
            window.location.reload()
        } catch (error: any) {
            alert(`Error confirming import: ${error.message}`)
        } finally {
            setIsCommitting(false)
        }
    }

    // ── §3 Download Pre-Flight Error Log (CSV) ────────────────────────────────
    const handleDownloadCSV = () => {
        if (!stagingResult) return

        const rows: string[][] = [
            ["Type", "Row #", "Name / Student", "Email", "Reason / Detail"]
        ]

        for (const r of (stagingResult.ignoredRows ?? [])) {
            rows.push(["IGNORED_ROW", String(r.rowNumber), r.name, "", r.reason])
        }

        for (const h of (stagingResult.headlessUsers ?? [])) {
            rows.push(["HEADLESS_USER", String(h.rowNumber), h.name, h.email, h.collisionDetail])
        }

        for (const c of (stagingResult.conflicts ?? [])) {
            rows.push([
                "FINANCIAL_CONFLICT",
                "",
                c.studentName,
                "",
                `Period ${c.periodNumber} | DB: $${c.dbAmount} | Excel: $${c.excelAmount}`
            ])
        }

        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url  = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `PreFlight_ErrorLog_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    // ── Render ────────────────────────────────────────────────────────────────
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

                    {/* ── Stats Row ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Card className="bg-blue-50/50 border-blue-200 cursor-pointer hover:bg-blue-100/50 transition-colors"
                              onClick={() => setShowIgnored(v => !v)}>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-blue-700">{stagingResult.skippedRowsCount || 0}</span>
                                <span className="text-sm font-medium text-blue-600">Rows Ignored</span>
                                <span className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                                    {showIgnored ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-emerald-50/50 border-emerald-200 shadow-sm border-2">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-emerald-700">{stagingResult.studentsDetected || 0}</span>
                                <span className="text-sm font-medium text-emerald-600">Estudiantes Nuevos (Pestaña Supervisados)</span>
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-50/50 border-purple-200 shadow-sm border-2">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-purple-700">{stagingResult.supervisorsDetected || 0}</span>
                                </div>
                                <span className="text-sm font-medium text-purple-600">Supervisores Nuevos (Pestaña Parametros)</span>
                                <span className="text-[10px] text-purple-400 font-mono mt-1">Fila 19+ Detected</span>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50/50 border-amber-200">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-amber-700">{stagingResult.newFinancialPeriods?.length || 0}</span>
                                <span className="text-sm font-medium text-amber-600">Financial Records</span>
                            </CardContent>
                        </Card>

                        <Card className="bg-orange-50/50 border-orange-200">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-orange-700">{stagingResult.conflicts?.length || 0}</span>
                                <span className="text-sm font-medium text-orange-600">Financial Conflicts</span>
                            </CardContent>
                        </Card>

                        <Card className="bg-rose-50/50 border-rose-200 cursor-pointer hover:bg-rose-100/50 transition-colors"
                              onClick={() => setShowHeadless(v => !v)}>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold text-rose-700">{stagingResult.headlessUsers?.length || 0}</span>
                                <span className="text-sm font-medium text-rose-600">Headless (Email Collision)</span>
                                <span className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                                    {showHeadless ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Rows Ignored Detail ───────────────────────────────── */}
                    {showIgnored && stagingResult.ignoredRows?.length > 0 && (
                        <Card className="border-blue-200 shadow-sm border">
                            <CardHeader className="bg-blue-50 py-3 px-4">
                                <CardTitle className="text-blue-800 text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Detalle de Filas Ignoradas ({stagingResult.ignoredRows.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y max-h-[220px] overflow-y-auto bg-white">
                                    {stagingResult.ignoredRows.map((r, idx) => (
                                        <div key={idx} className="px-4 py-2 flex items-center gap-3 text-sm">
                                            <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">Row {r.rowNumber}</span>
                                            <span className="font-medium truncate flex-1">{r.name}</span>
                                            <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded px-2 py-0.5 shrink-0">{r.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Headless Users Detail ─────────────────────────────── */}
                    {showHeadless && stagingResult.headlessUsers?.length > 0 && (
                        <Card className="border-rose-200 shadow-sm border-2">
                            <CardHeader className="bg-rose-50">
                                <CardTitle className="text-rose-800 flex items-center gap-2">
                                    <X className="h-5 w-5" />
                                    Headless Users — Email Collision ({stagingResult.headlessUsers.length})
                                </CardTitle>
                                <CardDescription className="text-rose-700/80">
                                    Los siguientes registros no tienen email único disponible. Se les asignará un email temporal <code>@pending.import</code>. Corrígelos desde la Bóveda.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y max-h-[280px] overflow-y-auto bg-white">
                                    {stagingResult.headlessUsers.map((h, idx) => {
                                        const badge = collisionBadge[h.collisionType] ?? { label: h.collisionDetail, className: "bg-gray-100 text-gray-600 border-gray-300" }
                                        return (
                                            <div key={idx} className="px-4 py-2 flex items-center gap-3">
                                                <X className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                                                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">Row {h.rowNumber}</span>
                                                <span className="text-sm font-medium flex-1 truncate">{h.name}</span>
                                                <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">{h.email !== "(none)" ? h.email : "—"}</span>
                                                <span className={`text-xs border rounded px-2 py-0.5 shrink-0 ${badge.className}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Merged Records ────────────────────────────────────── */}
                    {showMerged && stagingResult.mergedRecords?.length > 0 && (
                        <Card className="border-blue-200 shadow-sm border-2">
                            <CardHeader className="bg-blue-50">
                                <CardTitle className="text-blue-800 flex items-center gap-2 cursor-pointer" onClick={() => setShowMerged(v => !v)}>
                                    <AlertTriangle className="h-5 w-5" />
                                    Review Merged Records ({stagingResult.mergedRecords.length})
                                    {showMerged ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                                </CardTitle>
                                <CardDescription className="text-blue-700/80">
                                    El sistema detectó las siguientes filas como duplicados del mismo estudiante y procedió a unificarlas preservando el perfil más reciente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y max-h-[200px] overflow-y-auto bg-white">
                                    {stagingResult.mergedRecords.map((record: any, idx: number) => (
                                        <div key={idx} className="p-4 text-sm">
                                            El sistema detectó que las filas <strong>{record.allRowNumbers.join(", ")}</strong> pertenecen al mismo estudiante{" "}
                                            <span className="text-blue-700 font-medium">{record.traineeName}</span> (BACB_ID: {record.bacbId}) y han sido unificadas.
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Financial Conflict Resolution ─────────────────────── */}
                    {stagingResult.conflicts?.length > 0 && (
                        <Card className="border-amber-200 shadow-sm border-2">
                            <CardHeader className="bg-amber-50">
                                <CardTitle className="text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Financial Conflict Resolution
                                </CardTitle>
                                <CardDescription className="text-amber-700/80">
                                    The following records have differing amounts between the database and the uploaded Excel file.
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
                                <div className="overflow-x-auto bg-white">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                                                <th className="px-4 py-3 text-left">Estudiante</th>
                                                <th className="px-4 py-3 text-left">Periodo</th>
                                                <th className="px-4 py-3 text-right">Monto Actual (DB)</th>
                                                <th className="px-4 py-3 text-right">Monto Nuevo (Excel)</th>
                                                <th className="px-4 py-3 text-center">Acción Manual</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y max-h-[400px]">
                                            {stagingResult.conflicts.map((conflict: any) => (
                                                <tr key={conflict.id} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{conflict.studentName}</div>
                                                        <div className="text-[10px] text-muted-foreground uppercase">{conflict.type}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {conflict.month} (P#{conflict.periodNumber})
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-medium">
                                                        ${conflict.dbAmount}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">
                                                        ${conflict.excelAmount}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-1 justify-center">
                                                            <Button 
                                                                size="sm" 
                                                                variant={stagingResult.resolutions[conflict.id] === "sum" ? "default" : "outline"} 
                                                                className="h-7 text-[10px] rounded-full"
                                                                onClick={() => setResolution(conflict.id, "sum")}
                                                                title={`Sumar: $${Number(conflict.dbAmount || 0) + Number(conflict.excelAmount || 0)}`}
                                                            >
                                                                Sumar
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant={stagingResult.resolutions[conflict.id] === "replace" ? "default" : "outline"} 
                                                                className="h-7 text-[10px] rounded-full"
                                                                onClick={() => setResolution(conflict.id, "replace")}
                                                            >
                                                                Reemplazar
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant={stagingResult.resolutions[conflict.id] === "ignore" ? "default" : "outline"} 
                                                                className="h-7 text-[10px] rounded-full"
                                                                onClick={() => setResolution(conflict.id, "ignore")}
                                                            >
                                                                Ignorar
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Action Bar ────────────────────────────────────────── */}
                    <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setStagingResult(null)} disabled={isCommitting}>
                            Cancel
                        </Button>
                        {/* §3 Download Pre-Flight Error Log */}
                        <Button variant="outline" className="border-slate-300 text-slate-700" onClick={handleDownloadCSV} disabled={isCommitting}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Error Log (CSV)
                        </Button>
                        <Button 
                            variant="default" 
                            className="bg-amber-600 hover:bg-amber-700 text-white" 
                            onClick={handleCommit} 
                            disabled={isCommitting || stagingResult.supervisorsDetected === 0}
                        >
                            {isCommitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Confirm Atomic Injection (Commit)
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
