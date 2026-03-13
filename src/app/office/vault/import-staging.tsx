/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    UploadCloud, Loader2, AlertTriangle, FileSpreadsheet,
    Check, X, ChevronDown, ChevronUp, Download, Info
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface IgnoredRow { sheet: string; rowNumber: number; data: string; reason: string }
interface HeadlessUser { name: string; rowNumber: number; email: string; collisionType: string; collisionDetail: string }
interface StagingResult {
    ignoredRows: IgnoredRow[]
    skippedRowsCount: number
    studentsStats: { new: number; updated: number }
    supervisorsStats: { new: number; updated: number }
    financialStats: { clean: number; conflicts: number }
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

    const [showIgnored, setShowIgnored] = useState(false)
    const [showHeadless, setShowHeadless] = useState(true)
    const [showMerged,   setShowMerged]   = useState(false)

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
        if (!stagingResult) return
        setIsCommitting(true)
        try {
            const payload = {
                newUsers: stagingResult.newUsers,
                newSupervisors: stagingResult.newSupervisors,
                supervisorUpdates: stagingResult.supervisorUpdates,
                resolutions: stagingResult.resolutions,
                conflicts: stagingResult.conflicts,
                newFinancialPeriods: stagingResult.newFinancialPeriods,
                validData: stagingResult.validData
            }

            const res = await fetch("/api/office/vault/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error(await res.text())

            alert("Importación completada con éxito.")
            setFile(null)
            setStagingResult(null)
            window.location.reload()
        } catch (error: any) {
            alert(`Error confirming import: ${error.message}`)
        } finally {
            setIsCommitting(false)
        }
    }

    const handleDownloadCSV = () => {
        if (!stagingResult) return
        const rows: string[][] = [["Type", "Sheet", "Row #", "Name / Data", "Detail / Reason"]]
        
        for (const r of stagingResult.ignoredRows) {
            rows.push(["IGNORED_ROW", r.sheet, String(r.rowNumber), r.data, r.reason])
        }
        for (const h of stagingResult.headlessUsers) {
            rows.push(["HEADLESS_COLLISION", "Supervisados", String(h.rowNumber), h.name, `${h.collisionDetail} (${h.email})`])
        }
        for (const c of stagingResult.conflicts) {
            rows.push(["FINANCIAL_CONFLICT", "Cobros", "", c.studentName, `DB: $${c.dbAmount} | Excel: $${c.excelAmount}`])
        }

        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `PreFlight_Log_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            <Card className="border-2 border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                        <UploadCloud className="h-6 w-6 text-indigo-600" />
                        Massive Data Import Engine
                    </CardTitle>
                    <CardDescription>
                        Carga el archivo maestro .xlsx. Podrás revisar colisiones, unificaciones y conflictos financieros antes de la inyección final.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="import-excel">Archivo Excel (.xlsx)</Label>
                            <Input id="import-excel" type="file" accept=".xlsx" onChange={handleFileChange} className="bg-white" />
                        </div>
                        <Button onClick={handleUpload} disabled={!file || isStaging} className="bg-indigo-600 hover:bg-indigo-700">
                            {isStaging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                            Run Staging Phase
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {stagingResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* ── Stats Summary Cards ─────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-emerald-50 border-emerald-200 border-2">
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-700">{stagingResult.studentsStats.new + stagingResult.studentsStats.updated}</div>
                                <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Estudiantes</div>
                                <div className="mt-2 flex justify-center gap-3 text-[10px] items-center">
                                    <span className="px-2 py-0.5 bg-emerald-100 rounded-full border border-emerald-300">{stagingResult.studentsStats.new} Nuevos</span>
                                    <span className="px-2 py-0.5 bg-white rounded-full border border-emerald-200">{stagingResult.studentsStats.updated} Actualizados</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-50 border-purple-200 border-2">
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-purple-700">{stagingResult.supervisorsStats.new + stagingResult.supervisorsStats.updated}</div>
                                <div className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Supervisores</div>
                                <div className="mt-2 flex justify-center gap-3 text-[10px] items-center">
                                    <span className="px-2 py-0.5 bg-purple-100 rounded-full border border-purple-300">{stagingResult.supervisorsStats.new} Nuevos</span>
                                    <span className="px-2 py-0.5 bg-white rounded-full border border-purple-200">{stagingResult.supervisorsStats.updated} Actualizados</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50 border-amber-200 border-2">
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-amber-700">{stagingResult.financialStats.clean + stagingResult.financialStats.conflicts}</div>
                                <div className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Registros Cobros</div>
                                <div className="mt-2 flex justify-center gap-3 text-[10px] items-center">
                                    <span className="px-2 py-0.5 bg-amber-100 rounded-full border border-amber-300">{stagingResult.financialStats.clean} Limpios</span>
                                    <span className={`px-2 py-0.5 rounded-full border ${stagingResult.financialStats.conflicts > 0 ? 'bg-orange-500 text-white border-orange-600 animate-pulse' : 'bg-white border-amber-200'}`}>
                                        {stagingResult.financialStats.conflicts} Conflictos
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Card className="bg-rose-50 border-rose-200 border cursor-pointer hover:bg-rose-100/50 transition-colors" onClick={() => setShowHeadless(!showHeadless)}>
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold">{stagingResult.headlessUsers.length}</div>
                                    <div>
                                        <div className="text-xs font-bold text-rose-700 uppercase">Headless Collisions</div>
                                        <div className="text-[10px] text-rose-500">Emails duplicados o faltantes</div>
                                    </div>
                                </div>
                                {showHeadless ? <ChevronUp className="h-4 w-4 text-rose-400" /> : <ChevronDown className="h-4 w-4 text-rose-400" />}
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-50 border-blue-200 border cursor-pointer hover:bg-blue-100/50 transition-colors" onClick={() => setShowIgnored(!showIgnored)}>
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{stagingResult.ignoredRows.length}</div>
                                    <div>
                                        <div className="text-xs font-bold text-blue-700 uppercase">Rows Ignored</div>
                                        <div className="text-[10px] text-blue-500">Datos incompletos detectados</div>
                                    </div>
                                </div>
                                {showIgnored ? <ChevronUp className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Rows Ignored Detail ───────────────────────────────── */}
                    {showIgnored && stagingResult.ignoredRows.length > 0 && (
                        <Card className="border-blue-200 shadow-lg border-2 overflow-hidden">
                            <CardHeader className="bg-blue-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Detalle de Filas Ignoradas ({stagingResult.ignoredRows.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase">
                                            <tr>
                                                <th className="px-4 py-2">Pestaña</th>
                                                <th className="px-4 py-2">Fila</th>
                                                <th className="px-4 py-2">Dato Capturado</th>
                                                <th className="px-4 py-2">Motivo del Rechazo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y max-h-[300px]">
                                            {stagingResult.ignoredRows.map((r, i) => (
                                                <tr key={i} className="hover:bg-blue-50/50 font-medium">
                                                    <td className="px-4 py-2">{r.sheet}</td>
                                                    <td className="px-4 py-2">#{r.rowNumber}</td>
                                                    <td className="px-4 py-2 text-slate-400 max-w-[200px] truncate">{r.data}</td>
                                                    <td className="px-4 py-2"><span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{r.reason}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Headless Users Detail ─────────────────────────────── */}
                    {showHeadless && stagingResult.headlessUsers.length > 0 && (
                        <Card className="border-rose-200 border-2 shadow-lg overflow-hidden">
                            <CardHeader className="bg-rose-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Headless Log: Colisión de Emails ({stagingResult.headlessUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y max-h-[250px] overflow-y-auto bg-white">
                                    {stagingResult.headlessUsers.map((h, i) => (
                                        <div key={i} className="px-4 py-2.5 flex items-center gap-4 text-xs">
                                            <span className="font-bold text-rose-500 w-12 shrink-0">#{h.rowNumber}</span>
                                            <span className="font-semibold text-slate-800 flex-1">{h.name}</span>
                                            <span className="text-slate-400 italic truncate max-w-[150px]">{h.email}</span>
                                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${collisionBadge[h.collisionType]?.className}`}>
                                                {collisionBadge[h.collisionType]?.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Financial Resolution UI ───────────────────────────── */}
                    {stagingResult.conflicts.length > 0 && (
                        <Card className="border-orange-200 border-2 shadow-xl overflow-hidden">
                            <CardHeader className="bg-orange-600 py-3 px-4 text-white">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Resolución de Conflictos Financieros
                                </CardTitle>
                                <CardDescription className="text-orange-100 text-xs">
                                    Se detectaron discrepancias entre la base de datos y el archivo Excel. Debes decidir qué monto prevalece.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 bg-white">
                                <div className="p-2 border-b flex justify-between items-center bg-slate-50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Acción Global:</span>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-200 text-orange-600" onClick={() => setGlobalResolution("sum")}>Sumar Todo</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-200 text-orange-600" onClick={() => setGlobalResolution("replace")}>Reemplazar Todo</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-orange-200 text-orange-600" onClick={() => setGlobalResolution("ignore")}>Ignorar Todo</Button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b text-slate-400 font-bold uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Estudiante</th>
                                                <th className="px-4 py-3">Periodo</th>
                                                <th className="px-4 py-3 text-right">Monto DB</th>
                                                <th className="px-4 py-3 text-right">Monto Excel</th>
                                                <th className="px-4 py-3 text-center">Acción Manual</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y max-h-[400px]">
                                            {stagingResult.conflicts.map((c) => (
                                                <tr key={c.id} className="hover:bg-amber-50">
                                                    <td className="px-4 py-3 font-bold text-slate-700">{c.studentName}</td>
                                                    <td className="px-4 py-3 text-slate-500 lowercase">{c.month}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-400">${c.dbAmount}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-orange-600">${c.excelAmount}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-1 justify-center">
                                                            <Button size="sm" variant={stagingResult.resolutions[c.id] === 'sum' ? 'default' : 'outline'} className="h-6 text-[9px] px-2" onClick={() => setResolution(c.id, 'sum')}>Sumar</Button>
                                                            <Button size="sm" variant={stagingResult.resolutions[c.id] === 'replace' ? 'default' : 'outline'} className="h-6 text-[9px] px-2" onClick={() => setResolution(c.id, 'replace')}>Reemplazar</Button>
                                                            <Button size="sm" variant={stagingResult.resolutions[c.id] === 'ignore' ? 'default' : 'outline'} className="h-6 text-[9px] px-2" onClick={() => setResolution(c.id, 'ignore')}>Ignorar</Button>
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
                    <div className="flex justify-end gap-3 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <Button variant="ghost" className="text-slate-500" onClick={() => setStagingResult(null)} disabled={isCommitting}>Cancelar</Button>
                        <Button variant="outline" className="border-slate-300 text-slate-600" onClick={handleDownloadCSV} disabled={isCommitting}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Error Log (CSV)
                        </Button>
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" 
                            onClick={handleCommit} 
                            disabled={isCommitting || (stagingResult.supervisorsStats.new + stagingResult.supervisorsStats.updated) === 0}
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
