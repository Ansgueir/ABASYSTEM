"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    DatabaseBackup, RotateCcw, Trash2, RefreshCw, AlertTriangle,
    Download, Clock, HardDrive, CheckCircle2, Loader2
} from "lucide-react"

interface BackupFile {
    name: string
    sizeBytes: number
    createdAt: string
    modifiedAt: string
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    })
}

// ── RESET SECTION ──────────────────────────────────────────────────────────

function DataResetSection() {
    const [showModal, setShowModal] = useState(false)
    const [confirmText, setConfirmText] = useState("")
    const [loading, setLoading] = useState(false)

    const isConfirmed = confirmText === "CONFIRM"

    async function handleReset() {
        if (!isConfirmed) return
        setLoading(true)
        try {
            const res = await fetch("/api/office/vault/reset", { method: "POST" })
            const data = await res.json()
            if (data.success) {
                toast.success("✓ Data Reset Complete — All invoices reverted to READY_TO_GO")
                setShowModal(false)
                setConfirmText("")
            } else {
                toast.error(data.error || "Reset failed")
            }
        } catch {
            toast.error("Network error during reset")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="bg-destructive/15 p-2 rounded-lg">
                        <Trash2 className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <CardTitle className="text-destructive text-base">Factory Reset (Data Only)</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                            Clears all payment & billing records. Code and schema remain intact.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-xs text-muted-foreground space-y-1 mb-4 border border-destructive/20 rounded-lg p-3 bg-background">
                    <p className="font-semibold text-destructive mb-2">This will permanently delete:</p>
                    <p>• All <code>StudentPayment</code> records</p>
                    <p>• All <code>SupervisorLedgerEntry</code> records</p>
                    <p>• All <code>SupervisorPayout</code> records</p>
                    <p>• Revert all <code>Invoices</code> → <strong>READY_TO_GO</strong> with <code>amountPaid = 0</code></p>
                </div>
                <Button
                    variant="destructive"
                    onClick={() => setShowModal(true)}
                    className="w-full"
                >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Initiate Factory Reset
                </Button>
            </CardContent>

            <Dialog open={showModal} onOpenChange={(v) => { if (!v && !loading) { setShowModal(false); setConfirmText("") } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Factory Reset
                        </DialogTitle>
                        <DialogDescription>
                            This action is <strong>irreversible</strong>. All billing and payment data will be erased.
                            Type <strong className="text-foreground">CONFIRM</strong> below to proceed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        <Label htmlFor="confirm-input" className="text-sm font-medium">
                            Type <code className="bg-muted px-1 rounded">CONFIRM</code> to unlock:
                        </Label>
                        <Input
                            id="confirm-input"
                            autoComplete="off"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="CONFIRM"
                            className={`mt-2 font-mono tracking-widest ${isConfirmed ? "border-green-500 ring-1 ring-green-500" : ""}`}
                        />
                        {isConfirmed && (
                            <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Confirmed — button is now active
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setShowModal(false); setConfirmText("") }} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!isConfirmed || loading}
                            onClick={handleReset}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Execute Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// ── BACKUP SECTION ─────────────────────────────────────────────────────────

interface PendingBackup {
    name: string
    startedAt: Date
    expectedFilename: string
}

function BackupSection() {
    const [backups, setBackups] = useState<BackupFile[]>([])
    const [loadingList, setLoadingList] = useState(false)
    const [creating, setCreating] = useState(false)
    const [restoring, setRestoring] = useState<string | null>(null)
    const [backupName, setBackupName] = useState("")
    const [pendingBackup, setPendingBackup] = useState<PendingBackup | null>(null)
    const [pollSeconds, setPollSeconds] = useState(0)

    const loadBackups = useCallback(async (silent = false) => {
        if (!silent) setLoadingList(true)
        try {
            const res = await fetch("/api/office/vault/backup")
            const data = await res.json()
            if (data.success) {
                setBackups(data.backups)
                return data.backups as BackupFile[]
            }
        } catch {
            if (!silent) toast.error("Network error loading backups")
        } finally {
            if (!silent) setLoadingList(false)
        }
        return []
    }, [])

    useEffect(() => { loadBackups() }, [loadBackups])

    // ── Auto-poll when a backup is pending ───────────────────────
    useEffect(() => {
        if (!pendingBackup) return

        let elapsed = 0
        const MAX_WAIT = 30 // seconds

        const interval = setInterval(async () => {
            elapsed += 3
            setPollSeconds(elapsed)

            const list = await loadBackups(true)
            const found = list.find((f: BackupFile) => f.name === pendingBackup.expectedFilename)

            if (found || elapsed >= MAX_WAIT) {
                clearInterval(interval)
                setPendingBackup(null)
                setPollSeconds(0)
                setBackups(list)
                if (found) {
                    toast.success(`✓ Backup "${pendingBackup.expectedFilename}" is ready!`)
                } else {
                    toast.warning("Backup may still be running — refresh manually in a moment.")
                }
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [pendingBackup, loadBackups])

    async function handleCreateBackup() {
        if (!backupName.trim()) {
            toast.error("Please enter a backup name")
            return
        }
        setCreating(true)
        try {
            const res = await fetch("/api/office/vault/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: backupName.trim() })
            })
            const data = await res.json()
            if (data.success) {
                toast.info("⏳ Backup launched in background — polling for completion...")
                setPendingBackup({
                    name: backupName.trim(),
                    startedAt: new Date(),
                    expectedFilename: data.filename
                })
                setBackupName("")
            } else {
                toast.error(data.error || "Backup failed")
            }
        } catch {
            toast.error("Network error creating backup")
        } finally {
            setCreating(false)
        }
    }

    async function handleRestore(filename: string) {
        setRestoring(filename)
        try {
            const res = await fetch("/api/office/vault/backup/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`✓ ${data.message}`)
            } else {
                toast.error(data.error || "Restore failed")
            }
        } catch {
            toast.error("Network error during restore")
        } finally {
            setRestoring(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                        <DatabaseBackup className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Database Backup Manager</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                            Create named snapshots of the database. Stored at <code>/opt/aba-system/backups/</code>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Create Backup */}
                <div className="flex gap-2">
                    <Input
                        placeholder="e.g. before-audit-round-2"
                        value={backupName}
                        onChange={(e) => setBackupName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))}
                        className="font-mono text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleCreateBackup()}
                        disabled={!!pendingBackup}
                    />
                    <Button onClick={handleCreateBackup} disabled={creating || !backupName.trim() || !!pendingBackup} className="shrink-0">
                        {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DatabaseBackup className="h-4 w-4 mr-2" />}
                        Create Backup
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => loadBackups()} disabled={loadingList || !!pendingBackup} title="Refresh list">
                        <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
                    </Button>
                </div>

                {/* ── Pending Backup Progress Banner ─────────────────── */}
                {pendingBackup && (
                    <div className="flex items-center gap-3 border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-500" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                                Backup in progress: <code className="text-xs">{pendingBackup.expectedFilename}</code>
                            </p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                pg_dump running in background — checking every 3s ({pollSeconds}s elapsed, max 30s)
                            </p>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 shrink-0 text-[10px]">
                            {pollSeconds}/{30}s
                        </Badge>
                    </div>
                )}

                {/* Backup List */}
                {loadingList && !pendingBackup ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading backups...
                    </div>
                ) : backups.length === 0 && !pendingBackup ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg">
                        <HardDrive className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No backups found yet.</p>
                        <p className="text-xs mt-1">Create your first backup above.</p>
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Name</th>
                                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Created</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Size</th>
                                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Pending row — shown while polling */}
                                {pendingBackup && (
                                    <tr className="border-t bg-blue-50/50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
                                                <span className="font-mono text-xs truncate max-w-[200px] text-blue-700">{pendingBackup.expectedFilename}</span>
                                                <Badge variant="secondary" className="text-[9px] py-0 h-4 bg-blue-100 text-blue-600">GENERATING…</Badge>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-xs text-blue-500">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(pendingBackup.startedAt.toISOString())}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs text-blue-400">—</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs text-blue-400 italic">wait...</span>
                                        </td>
                                    </tr>
                                )}
                                {backups.map((b, i) => (
                                    <tr key={b.name} className={`border-t hover:bg-muted/20 transition-colors ${i === 0 && !pendingBackup ? "bg-green-50/50" : ""}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="font-mono text-xs truncate max-w-[200px]">{b.name}</span>
                                                {i === 0 && !pendingBackup && <Badge variant="secondary" className="text-[9px] py-0 h-4 bg-green-100 text-green-700">LATEST</Badge>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(b.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs text-muted-foreground">{formatBytes(b.sizeBytes)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleRestore(b.name)}
                                                disabled={restoring === b.name || !!pendingBackup}
                                                className="h-7 px-2 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                            >
                                                {restoring === b.name
                                                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                    : <RotateCcw className="h-3 w-3 mr-1" />
                                                }
                                                Restore
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────

export function DbControlTab() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                    <h2 className="font-semibold text-sm">Database Control Panel</h2>
                    <p className="text-xs text-muted-foreground">God Mode — Restricted to qa-super@abasystem.com only</p>
                </div>
            </div>

            <DataResetSection />
            <BackupSection />
        </div>
    )
}
