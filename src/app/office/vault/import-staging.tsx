/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    UploadCloud, Loader2, AlertTriangle, FileSpreadsheet,
    Check, X, ChevronDown, ChevronUp, Download, Info,
    Receipt, Users
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface IgnoredRow { sheet: string; sourceSheet: string; rowNumber: number | string; data: string; reason: string }
interface HeadlessUser { name: string; sourceSheet: string; rowNumber: number | string; email: string; collisionType: string; collisionDetail: string }
interface StagingResult {
    ignoredRows: IgnoredRow[]
    skippedRowsCount: number
    studentsStats: { new: number; updated: number }
    supervisorsStats: { new: number; updated: number }
    financialStats: { clean: number; conflicts: number }
    transactionStats?: { new: number }
    newUsers: any[]
    newSupervisors: any[]
    newOffices: any[] // Added
    conflicts: any[]
    headlessUsers: HeadlessUser[]
    mergedRecords: any[]
    newFinancialPeriods: any[]
    newRawPayments?: any[]
    supervisorUpdates: any[]
    validData: { studentsToUpdate: any[] }
    resolutions: Record<string, "sum" | "replace" | "ignore">
}

const collisionBadge: Record<string, { label: string; className: string }> = {
    EMAIL_EMPTY:            { label: "Email Vacío",                   className: "bg-gray-100 text-gray-600 border-gray-300" },
    EMAIL_IN_DB:            { label: "Email ya existe en BD",         className: "bg-red-100 text-red-700 border-red-300" },
    EMAIL_DUPLICATE_IN_FILE: { label: "Email duplicado en Excel",     className: "bg-orange-100 text-orange-700 border-orange-300" },
    EMAIL_DUPLICATE:         { label: "Email Duplicado",              className: "bg-orange-100 text-orange-700 border-orange-300" }, // Added
}

export function ImportStaging() {
    const [file, setFile] = useState<File | null>(null)
    const [isStaging, setIsStaging] = useState(false)
    const [isCommitting, setIsCommitting] = useState(false)
    const [stagingResult, setStagingResult] = useState<StagingResult | null>(null)

    const [showIgnored,     setShowIgnored]     = useState(false)
    const [showHeadless,    setShowHeadless]    = useState(false)
    const [showStudents,    setShowStudents]    = useState(false)
    const [showSupervisors, setShowSupervisors] = useState(false)
    const [showOffices,     setShowOffices]     = useState(false) // Added
    const [showFinancial,   setShowFinancial]   = useState(false)
    const [showRawPayments, setShowRawPayments] = useState(false)
    const [showConflicts,   setShowConflicts]   = useState(false)
    const [showUsers,       setShowUsers]       = useState(false)

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
                newOffices: stagingResult.newOffices, // Added
                supervisorUpdates: stagingResult.supervisorUpdates,
                resolutions: stagingResult.resolutions,
                conflicts: stagingResult.conflicts,
                newFinancialPeriods: stagingResult.newFinancialPeriods,
                newPayments: stagingResult.newRawPayments,
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
            rows.push(["IGNORED_ROW", r.sourceSheet || r.sheet, String(r.rowNumber), r.data, r.reason])
        }
        for (const h of stagingResult.headlessUsers) {
            rows.push(["HEADLESS_COLLISION", h.sourceSheet || "Supervisados", String(h.rowNumber), h.name, `${h.collisionDetail} (${h.email})`])
        }
        for (const c of stagingResult.conflicts) {
            rows.push(["FINANCIAL_CONFLICT", c.sourceSheet || "Cobros", String(c.rowNumber), c.studentName, `DB: $${c.dbAmount} | Excel: $${c.excelAmount}`])
        }
        if (stagingResult.newRawPayments) {
            for (const p of stagingResult.newRawPayments) {
                rows.push(["RAW_PAYMENT", p.sourceSheet, String(p.rowNumber), p.studentName, `Amount: $${p.amount} | Method: ${p.paymentType}`])
            }
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
                    <div className="flex items-end gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 flex-wrap">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="import-excel">Archivo Excel (.xlsx)</Label>
                            <Input id="import-excel" type="file" accept=".xlsx" onChange={handleFileChange} className="bg-white" />
                        </div>
                        <Button onClick={handleUpload} disabled={!file || isStaging} className="bg-indigo-600 hover:bg-indigo-700">
                            {isStaging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                            Run Staging Phase
                        </Button>
                        <div className="flex-1 min-w-[20px]" />
                        <Button onClick={() => window.open('/api/office/vault/export', '_blank')} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
                            <Download className="h-4 w-4 mr-2" />
                            Download DB Export (Consolidated)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {stagingResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* ── Stats Summary Cards ─────────────────────────────── */}
                    {/* ── 6-Card Audit Grid ────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Rows Ignored (Blue) */}
                        <Card className="bg-blue-50 border-blue-200 border-2 cursor-pointer hover:bg-blue-100/50 transition-colors" onClick={() => setShowIgnored(!showIgnored)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-blue-700">{stagingResult.ignoredRows.length}</div>
                                <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Rows Ignored</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-blue-500">
                                    {showIgnored ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Students New (Green) */}
                        <Card className="bg-emerald-50 border-emerald-200 border-2 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => setShowStudents(!showStudents)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-700">{stagingResult.studentsStats.new}</div>
                                <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Estudiantes Nuevos (Pestaña Supervisados)</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-500">
                                    {showStudents ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Perfiles Staff Card ────────────────────────────────── */}
                        <Card className="bg-emerald-50 border-emerald-200 border-2 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => setShowUsers(!showUsers)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-700">{stagingResult.newUsers.length + stagingResult.newSupervisors.length + (stagingResult.newOffices?.length || 0)}</div>
                                <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Perfiles Staff (Nuevos)</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-500">
                                    {showUsers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Raw Transactions Card ─────────────────────────── */}
                        <Card className="bg-indigo-50 border-indigo-200 border-2 cursor-pointer hover:bg-indigo-100/50 transition-colors" onClick={() => setShowRawPayments(!showRawPayments)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-indigo-700">{stagingResult.transactionStats?.new || 0}</div>
                                <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Transacciones Raw (Tesoreria)</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-indigo-500">
                                    {showRawPayments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Supervisors New (Purple) */}
                        <Card className="bg-purple-50 border-purple-200 border-2 cursor-pointer hover:bg-purple-100/50 transition-colors" onClick={() => setShowSupervisors(!showSupervisors)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-purple-700">{stagingResult.supervisorsStats.new}</div>
                                <div className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Supervisores Nuevos (Pestaña Parametros)</div>
                                <div className="text-[10px] text-purple-400 mt-1">Fila 19+ Detected</div>
                                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-purple-500">
                                    {showSupervisors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Financial Records (Amber) */}
                        <Card className="bg-amber-50 border-amber-200 border-2 cursor-pointer hover:bg-amber-100/50 transition-colors" onClick={() => setShowFinancial(!showFinancial)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-amber-500">{stagingResult.financialStats.clean}</div>
                                <div className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Financial Records</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-amber-500">
                                    {showFinancial ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* 5. Financial Conflicts (Orange) */}
                        <Card className={`border-2 cursor-pointer transition-colors ${stagingResult.financialStats.conflicts > 0 ? 'bg-orange-50 border-orange-200 hover:bg-orange-100/50' : 'bg-slate-50 border-slate-200 opacity-60'}`} onClick={() => setShowConflicts(!showConflicts)}>
                            <CardContent className="p-4 text-center">
                                <div className={`text-3xl font-bold ${stagingResult.financialStats.conflicts > 0 ? 'text-orange-600 animate-pulse' : 'text-slate-400'}`}>
                                    {stagingResult.financialStats.conflicts}
                                </div>
                                <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider">Financial Conflicts</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-orange-500">
                                    {showConflicts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
                            </CardContent>
                        </Card>

                        {/* 6. Headless Users (Red) */}
                        <Card className={`border-2 cursor-pointer transition-colors ${stagingResult.headlessUsers.length > 0 ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/50' : 'bg-slate-50 border-slate-200 opacity-60'}`} onClick={() => setShowHeadless(!showHeadless)}>
                            <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-rose-700">{stagingResult.headlessUsers.length}</div>
                                <div className="text-sm font-semibold text-rose-600 uppercase tracking-wider">Headless (Email Collision)</div>
                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-rose-500">
                                    {showHeadless ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Detail
                                </div>
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
                                                    <td className="px-4 py-2 text-blue-700 bg-blue-100/30">{r.sourceSheet || r.sheet}</td>
                                                    <td className="px-4 py-2 font-mono text-blue-600">#{r.rowNumber}</td>
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
                                            <span className="text-rose-700 bg-rose-100/40 px-2 py-1 rounded font-bold w-24 truncate">{h.sourceSheet || "Supervisados"}</span>
                                            <span className="font-bold text-rose-500 w-24 shrink-0">#{h.rowNumber}</span>
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

                    {/* ── New Students Detail ─────────────────────────────── */}
                    {(showStudents || showUsers) && stagingResult.newUsers.length > 0 && (
                        <Card className="border-emerald-200 shadow-lg border-2 overflow-hidden">
                            <CardHeader className="bg-emerald-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    Nuevos Estudiantes Detectados ({stagingResult.newUsers.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-emerald-50 text-emerald-700 sticky top-0">
                                            <tr>
                                                <th className="p-2">Pestaña</th>
                                                <th className="p-2">Fila</th>
                                                <th className="p-2">Name</th>
                                                <th className="p-2">Supervisor</th>
                                                <th className="p-2">Hours (Reg/Conc/Ind)</th>
                                                <th className="p-2">Balances ($ T/A/O)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stagingResult.newUsers.map((u, i) => (
                                                <tr key={i} className="border-t border-emerald-100 bg-white hover:bg-emerald-50/30">
                                                    <td className="p-2 font-bold text-emerald-800 bg-emerald-100/20">{u.sourceSheet || "Supervisados"}</td>
                                                    <td className="p-2 font-mono text-emerald-600">#{u.rowNumber}</td>
                                                    <td className="p-2">
                                                        <div className="font-bold">{u.fullName}</div>
                                                        <div className="text-[10px] text-slate-400">{u.email}</div>
                                                    </td>
                                                    <td className="p-2">{u.fields?.supervisorName || "-"}</td>
                                                    <td className="p-2 font-mono">
                                                        {u.fields?.hoursTargetReg || 0}/{u.fields?.hoursTargetConc || 0}/{u.fields?.independentHoursTarget || 0}
                                                    </td>
                                                    <td className="p-2 font-bold text-emerald-700">
                                                        ${u.fields?.totalAmountContract || 0} / ${u.fields?.analystPaymentRate || 0} / ${u.fields?.officePaymentRate || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── New Offices Detail ─────────────────────────────── */}
                    {(showOffices || showUsers) && stagingResult.newOffices && stagingResult.newOffices.length > 0 && (
                        <Card className="border-indigo-200 shadow-lg border-2 overflow-hidden mb-6">
                            <CardHeader className="bg-indigo-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Nuevos Perfiles de Oficina Detectados ({stagingResult.newOffices.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-indigo-50 text-indigo-700 sticky top-0">
                                            <tr>
                                                <th className="p-2">Pestaña</th>
                                                <th className="p-2">Fila</th>
                                                <th className="p-2">Full Name</th>
                                                <th className="p-2">Email</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stagingResult.newOffices.map((u, i) => (
                                                <tr key={i} className="border-t border-indigo-100 bg-white hover:bg-indigo-50/30">
                                                    <td className="p-2 font-bold text-indigo-800 bg-indigo-100/20">{u.sourceSheet || "OFFICES"}</td>
                                                    <td className="p-2 font-mono text-indigo-600">#{u.rowNumber}</td>
                                                    <td className="p-2 font-bold">{u.fullName}</td>
                                                    <td className="p-2">{u.email}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {(showSupervisors || showUsers) && stagingResult.newSupervisors.length > 0 && (
                        <Card className="border-purple-200 shadow-lg border-2 overflow-hidden">
                            <CardHeader className="bg-purple-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    Nuevos Supervisores Detectados ({stagingResult.newSupervisors.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-purple-50 text-purple-700 sticky top-0">
                                            <tr>
                                                <th className="p-2">Pestaña</th>
                                                <th className="p-2">Fila</th>
                                                <th className="p-2">Full Name</th>
                                                <th className="p-2">Email</th>
                                                <th className="p-2">BACB ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stagingResult.newSupervisors.map((u, i) => (
                                                <tr key={i} className="border-t border-purple-100 bg-white hover:bg-purple-50/30">
                                                    <td className="p-2 font-bold text-purple-800 bg-purple-100/20">{u.sourceSheet || "Parametros"}</td>
                                                    <td className="p-2 font-mono text-purple-600">#{u.rowNumber}</td>
                                                    <td className="p-2 font-bold">{u.fullName}</td>
                                                    <td className="p-2">{u.email}</td>
                                                    <td className="p-2">{u.bacbId}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Financial Records Detail ──────────────────────────── */}
                    {showFinancial && stagingResult.newFinancialPeriods.length > 0 && (
                        <Card className="border-amber-200 shadow-lg border-2 overflow-hidden">
                            <CardHeader className="bg-amber-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Registros de Cobros Limpios ({stagingResult.newFinancialPeriods.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-amber-50 text-amber-700 sticky top-0">
                                            <tr>
                                                <th className="p-2">Pestaña</th>
                                                <th className="p-2">Fila</th>
                                                <th className="p-2">Trainee</th>
                                                <th className="p-2">Periodo</th>
                                                <th className="p-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stagingResult.newFinancialPeriods.map((f, i) => (
                                                <tr key={i} className="border-t border-amber-100 bg-white hover:bg-amber-50/30">
                                                    <td className="p-2 font-bold text-amber-800 bg-amber-100/30">{f.sourceSheet || "Cobros"}</td>
                                                    <td className="p-2 font-mono text-amber-600">#{f.rowNumber}</td>
                                                    <td className="p-2 font-bold">{f.studentName || f.traineeName}</td>
                                                    <td className="p-2">{f.monthYearLabel}</td>
                                                    <td className="p-2 text-emerald-600 font-bold">${f.amountDueOffice}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                     {/* ── Raw Transactions Detail ──────────────────────────── */}
                     {showRawPayments && stagingResult.newRawPayments && stagingResult.newRawPayments.length > 0 && (
                        <Card className="border-indigo-200 shadow-lg border-2 overflow-hidden">
                            <CardHeader className="bg-indigo-600 py-3 px-4">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    Transacciones Detectadas (Base Datos/Tesoreria)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-indigo-50 text-indigo-700 sticky top-0">
                                            <tr>
                                                <th className="p-2">Pestaña</th>
                                                <th className="p-2">Fila</th>
                                                <th className="p-2">Fecha</th>
                                                <th className="p-2">Estudiante</th>
                                                <th className="p-2">Monto</th>
                                                <th className="p-2">Metodo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stagingResult.newRawPayments.map((p, i) => (
                                                <tr key={i} className="border-t border-indigo-100 bg-white hover:bg-indigo-50/30">
                                                    <td className="p-2 font-bold text-indigo-800 bg-indigo-100/20">{p.sourceSheet}</td>
                                                    <td className="p-2 font-mono text-indigo-600">#{p.rowNumber}</td>
                                                    <td className="p-2">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}</td>
                                                    <td className="p-2 font-bold">{p.studentName}</td>
                                                    <td className="p-2 font-black text-indigo-700">${p.amount}</td>
                                                    <td className="p-2 uppercase text-[9px]"><span className="bg-indigo-100 px-1.5 py-0.5 rounded">{p.paymentType}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Financial Resolution UI ───────────────────────────── */}
                    {showConflicts && stagingResult.conflicts.length > 0 && (
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
                                                <th className="px-4 py-3">Pestaña</th>
                                                <th className="px-4 py-3">Fila</th>
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
                                                    <td className="px-4 py-3 text-orange-800 font-bold bg-orange-100/20">{c.sourceSheet || "Cobros"}</td>
                                                    <td className="px-4 py-3 font-mono text-orange-600">#{c.rowNumber}</td>
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
                            disabled={
                                isCommitting || 
                                (stagingResult.studentsStats.new + stagingResult.studentsStats.updated + 
                                 stagingResult.supervisorsStats.new + stagingResult.supervisorsStats.updated + 
                                 (stagingResult.newOffices?.length || 0) + stagingResult.newFinancialPeriods.length) === 0
                            }
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
