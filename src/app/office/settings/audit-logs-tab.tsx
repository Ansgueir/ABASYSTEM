"use client"

import { useState, useEffect } from "react"
import { getAuditLogs } from "@/actions/audit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Eye, Loader2, Shield } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export function AuditLogsTab() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const [filterAction, setFilterAction] = useState("ALL")
    const [filterEntity, setFilterEntity] = useState("ALL")
    const [filterSearch, setFilterSearch] = useState("")

    const fetchLogs = async () => {
        setLoading(true)
        const result = await getAuditLogs({
            page,
            limit: 50,
            action: filterAction,
            entity: filterEntity,
            search: filterSearch
        })

        if (result.success) {
            setLogs(result.logs)
            setTotal(result.total)
        } else {
            toast.error(result.error || "Failed to fetch audit logs")
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [page, filterAction, filterEntity])

    const handleSearch = () => {
        setPage(1)
        fetchLogs()
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    Security Audit Logs
                </CardTitle>
                <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
                    Total Events: {total}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6 mt-2">
                    <Select value={filterAction} onValueChange={setFilterAction}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Actions</SelectItem>
                            <SelectItem value="CREATE">CREATE</SelectItem>
                            <SelectItem value="UPDATE">UPDATE</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="LOGIN">LOGIN</SelectItem>
                            <SelectItem value="UPLOAD">UPLOAD</SelectItem>
                            <SelectItem value="DOWNLOAD">DOWNLOAD</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterEntity} onValueChange={setFilterEntity}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Entities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Entities</SelectItem>
                            <SelectItem value="Student">Student</SelectItem>
                            <SelectItem value="Supervisor">Supervisor</SelectItem>
                            <SelectItem value="Contract">Contract</SelectItem>
                            <SelectItem value="Document">Document</SelectItem>
                            <SelectItem value="ActivityLog">Activity Log</SelectItem>
                            <SelectItem value="Invoice">Invoice</SelectItem>
                            <SelectItem value="Payment">Payment</SelectItem>
                            <SelectItem value="User">User</SelectItem>
                            <SelectItem value="System">System</SelectItem>
                        </SelectContent>
                    </Select>

                    <Input
                        placeholder="Search ID, Email, Detail..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="max-w-[250px]"
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                        Filter
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground border rounded-xl bg-muted/20 border-dashed">
                        No audit logs found matching criteria.
                    </div>
                ) : (
                    <div className="border rounded-xl bg-background overflow-hidden relative overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>User / Email</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-right">Inspect</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-muted/10">
                                        <TableCell className="whitespace-nowrap font-medium text-xs">
                                            {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                <p className="font-semibold text-foreground">{log.userEmail}</p>
                                                <p className="text-muted-foreground font-mono">{log.userId.substring(0, 8)}...</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                log.action === "DELETE" ? "destructive" :
                                                    log.action === "CREATE" || log.action === "UPLOAD" ? "success" : "secondary"
                                            }>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                <p className="font-semibold">{log.entity}</p>
                                                {log.entityId && <p className="text-muted-foreground font-mono">ID: {log.entityId.substring(0, 8)}...</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground max-w-[200px] truncate block">
                                                {log.details || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <Shield className="h-5 w-5" />
                                                            Audit Event Details
                                                        </DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-xl border">
                                                            <div>
                                                                <span className="text-muted-foreground block text-xs">Event Timestamp</span>
                                                                <span className="font-semibold">{format(new Date(log.createdAt), "PP pp")}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground block text-xs">Audit ID</span>
                                                                <span className="font-mono text-xs text-muted-foreground break-all">{log.id}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground block text-xs">Action & Entity</span>
                                                                <span className="font-semibold">{log.action} on {log.entity}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground block text-xs">Target Entity ID</span>
                                                                <span className="font-mono text-xs">{log.entityId || "N/A"}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-muted-foreground block text-xs">User Signature</span>
                                                                <span className="font-medium">{log.userEmail} <span className="text-muted-foreground font-mono">({log.userId})</span></span>
                                                            </div>
                                                            {log.details && (
                                                                <div className="col-span-2 mt-2">
                                                                    <span className="text-muted-foreground block text-xs">Description Context</span>
                                                                    <span className="text-sm bg-background p-2 border rounded block mt-1">{log.details}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {log.oldValues && Object.keys(log.oldValues).length > 0 && (
                                                            <div className="mt-4">
                                                                <h4 className="text-xs font-semibold text-destructive uppercase mb-2">Previous State</h4>
                                                                <pre className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg overflow-x-auto border border-destructive/20">
                                                                    {JSON.stringify(log.oldValues, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}

                                                        {log.newValues && Object.keys(log.newValues).length > 0 && (
                                                            <div className="mt-4">
                                                                <h4 className="text-xs font-semibold text-success uppercase mb-2">New State</h4>
                                                                <pre className="bg-success/10 text-success text-xs p-3 rounded-lg overflow-x-auto border border-success/20">
                                                                    {JSON.stringify(log.newValues, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} events
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(prev => prev - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page * 50 >= total}
                            onClick={() => setPage(prev => prev + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
