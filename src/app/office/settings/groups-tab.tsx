"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    Plus, Trash2, Loader2, Users, Clock, Calendar, Search,
    X, Check, ChevronDown, ChevronUp, Edit2
} from "lucide-react"

// ── Types ───────────────────────────────────────────────────────────────────

interface AssignedSupervisor {
    id: string
    supervisorId: string
    supervisor: {
        id: string
        fullName: string
        email: string
        credentialType: string
    }
}

interface OfficeGroup {
    id: string
    name: string
    groupType: "REGULAR" | "CONCENTRATED"
    dayOfWeek: string
    startTime: string
    endTime: string
    supervisors: AssignedSupervisor[]
}

interface Supervisor {
    id: string
    fullName: string
    email: string
    credentialType: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
const DAY_LABELS: Record<string, string> = {
    MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday"
}
const TYPE_COLORS: Record<string, string> = {
    REGULAR: "bg-blue-100 text-blue-700 border-blue-200",
    CONCENTRATED: "bg-orange-100 text-orange-700 border-orange-200"
}

// ── Supervisor Assignment Panel ──────────────────────────────────────────────

function SupervisorPanel({
    group, allSupervisors, onAssign, onRemove
}: {
    group: OfficeGroup
    allSupervisors: Supervisor[]
    onAssign: (groupId: string, supervisorId: string) => Promise<void>
    onRemove: (groupId: string, supervisorId: string) => Promise<void>
}) {
    const [searchAssigned, setSearchAssigned] = useState("")
    const [searchAvailable, setSearchAvailable] = useState("")
    const [loading, setLoading] = useState<string | null>(null)

    const assignedIds = new Set(group.supervisors.map(s => s.supervisorId))
    const assigned = group.supervisors.map(s => s.supervisor)
    const available = allSupervisors.filter(s => !assignedIds.has(s.id))

    const filteredAssigned = assigned.filter(s =>
        s.fullName.toLowerCase().includes(searchAssigned.toLowerCase()) ||
        s.email.toLowerCase().includes(searchAssigned.toLowerCase())
    )
    const filteredAvailable = available.filter(s =>
        s.fullName.toLowerCase().includes(searchAvailable.toLowerCase()) ||
        s.email.toLowerCase().includes(searchAvailable.toLowerCase())
    )

    const handleAction = async (action: () => Promise<void>, key: string) => {
        setLoading(key)
        try { await action() } finally { setLoading(null) }
    }

    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Currently Assigned */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        Currently Assigned
                    </p>
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        {assigned.length}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        className="pl-9 h-9 text-sm rounded-xl"
                        placeholder="Search assigned by name or email..."
                        value={searchAssigned}
                        onChange={e => setSearchAssigned(e.target.value)}
                    />
                </div>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {filteredAssigned.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-xl">
                            No supervisors assigned yet
                        </p>
                    ) : filteredAssigned.map(sup => (
                        <div key={sup.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{sup.fullName}</p>
                                <p className="text-xs text-muted-foreground">{sup.email}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={loading === `remove-${sup.id}`}
                                onClick={() => handleAction(() => onRemove(group.id, sup.id), `remove-${sup.id}`)}
                            >
                                {loading === `remove-${sup.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Available Unassigned */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        Available
                    </p>
                    <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {available.length}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        className="pl-9 h-9 text-sm rounded-xl"
                        placeholder="Search available by name or email..."
                        value={searchAvailable}
                        onChange={e => setSearchAvailable(e.target.value)}
                    />
                </div>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {filteredAvailable.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-xl">
                            All supervisors assigned
                        </p>
                    ) : filteredAvailable.map(sup => (
                        <div key={sup.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{sup.fullName}</p>
                                <p className="text-xs text-muted-foreground">{sup.email}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 shrink-0 text-primary hover:bg-primary/10 hover:text-primary border-primary/30 font-semibold"
                                disabled={loading === `assign-${sup.id}`}
                                onClick={() => handleAction(() => onAssign(group.id, sup.id), `assign-${sup.id}`)}
                            >
                                {loading === `assign-${sup.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                Assign
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Group Card ────────────────────────────────────────────────────────────────

function GroupCard({
    group, allSupervisors, onDelete, onAssign, onRemove, onEdit
}: {
    group: OfficeGroup
    allSupervisors: Supervisor[]
    onDelete: (id: string) => Promise<void>
    onAssign: (groupId: string, supervisorId: string) => Promise<void>
    onRemove: (groupId: string, supervisorId: string) => Promise<void>
    onEdit: (group: OfficeGroup) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [deleting, setDeleting] = useState(false)

    return (
        <Card className="overflow-hidden border-muted/60 hover:shadow-md transition-all">
            <div className={`h-1 ${group.groupType === "REGULAR" ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-gradient-to-r from-orange-500 to-amber-400"}`} />
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                        <CardTitle className="text-base font-bold text-slate-800">{group.name}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] font-bold ${TYPE_COLORS[group.groupType]}`}>
                                {group.groupType}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-semibold">
                                <Calendar className="h-2.5 w-2.5 mr-1" />
                                {DAY_LABELS[group.dayOfWeek]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50">
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {group.startTime} – {group.endTime}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {group.supervisors.length}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(group)}>
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            disabled={deleting}
                            onClick={async () => {
                                setDeleting(true)
                                await onDelete(group.id)
                                setDeleting(false)
                            }}
                        >
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)}>
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="pt-0 border-t">
                    <SupervisorPanel
                        group={group}
                        allSupervisors={allSupervisors}
                        onAssign={onAssign}
                        onRemove={onRemove}
                    />
                </CardContent>
            )}
        </Card>
    )
}

// ── Create / Edit Dialog ─────────────────────────────────────────────────────

function GroupDialog({
    open, onClose, onSave, existingGroups, editing
}: {
    open: boolean
    onClose: () => void
    onSave: (data: any, editId?: string) => Promise<void>
    existingGroups: OfficeGroup[]
    editing: OfficeGroup | null
}) {
    const [form, setForm] = useState({ name: "", groupType: "REGULAR", dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00" })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (editing) {
            setForm({ name: editing.name, groupType: editing.groupType, dayOfWeek: editing.dayOfWeek, startTime: editing.startTime, endTime: editing.endTime })
        } else {
            setForm({ name: "", groupType: "REGULAR", dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00" })
        }
    }, [editing, open])

    // Compute which days are already taken for the selected groupType (excluding current if editing)
    const takenDays = useMemo(() => {
        return new Set(
            existingGroups
                .filter(g => g.groupType === form.groupType && (!editing || g.id !== editing.id))
                .map(g => g.dayOfWeek)
        )
    }, [existingGroups, form.groupType, editing])

    const F = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [field]: e.target.value }))

    const handleSave = async () => {
        if (!form.name.trim()) return toast.error("Name is required")
        if (takenDays.has(form.dayOfWeek)) return toast.error(`A ${form.groupType} group already exists for that day`)
        setSaving(true)
        await onSave(form, editing?.id)
        setSaving(false)
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editing ? <Edit2 className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-green-500" />}
                        {editing ? "Edit Group" : "New Group"}
                    </DialogTitle>
                    <DialogDescription>
                        {editing ? "Update the group name or schedule." : "Define the type, day and schedule for this supervision group."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Group Name</Label>
                        <Input value={form.name} onChange={F("name")} placeholder="e.g. Regular Group Monday AM" />
                    </div>

                    {!editing && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <select
                                    value={form.groupType}
                                    onChange={F("groupType")}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="REGULAR">Regular</option>
                                    <option value="CONCENTRATED">Concentrated</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Day</Label>
                                <select
                                    value={form.dayOfWeek}
                                    onChange={F("dayOfWeek")}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {DAYS.map(d => (
                                        <option key={d} value={d} disabled={takenDays.has(d)}>
                                            {DAY_LABELS[d]}{takenDays.has(d) ? " (taken)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input type="time" value={form.startTime} onChange={F("startTime")} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input type="time" value={form.endTime} onChange={F("endTime")} />
                        </div>
                    </div>

                    {!editing && (
                        <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
                            <p className="font-semibold mb-1">Business Rule:</p>
                            <p>Max 1 <strong>Regular</strong> group + 1 <strong>Concentrated</strong> group per day. Maximum 14 groups total.</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {editing ? "Save Changes" : "Create Group"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

export function GroupsTab() {
    const [groups, setGroups] = useState<OfficeGroup[]>([])
    const [allSupervisors, setAllSupervisors] = useState<Supervisor[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<OfficeGroup | null>(null)

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const res = await fetch("/api/office/groups")
            const data = await res.json()
            if (data.success) {
                setGroups(data.groups)
                setAllSupervisors(data.allSupervisors)
            }
        } catch { if (!silent) toast.error("Error loading groups") }
        finally { if (!silent) setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleCreate = async (form: any, editId?: string) => {
        const url = editId ? `/api/office/groups/${editId}` : "/api/office/groups"
        const method = editId ? "PATCH" : "POST"
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        const data = await res.json()
        if (data.success) {
            toast.success(editId ? "Group updated" : "Group created")
            setDialogOpen(false)
            setEditing(null)
            load()
        } else {
            toast.error(data.error || "Error")
        }
    }

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/office/groups/${id}`, { method: "DELETE" })
        const data = await res.json()
        if (data.success) { toast.success("Group deleted"); load() }
        else toast.error(data.error || "Error deleting group")
    }

    const handleAssign = async (groupId: string, supervisorId: string) => {
        const res = await fetch(`/api/office/groups/${groupId}/supervisors`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supervisorId })
        })
        const data = await res.json()
        if (data.success) { load(true) } else toast.error(data.error || "Error assigning supervisor")
    }

    const handleRemove = async (groupId: string, supervisorId: string) => {
        const res = await fetch(`/api/office/groups/${groupId}/supervisors`, {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supervisorId })
        })
        const data = await res.json()
        if (data.success) { load(true) } else toast.error(data.error || "Error removing supervisor")
    }

    // Group by type and sort by day-of-week order (Mon → Sun)
    const dayOrder = (g: OfficeGroup) => DAYS.indexOf(g.dayOfWeek)
    const regularGroups = groups.filter(g => g.groupType === "REGULAR").sort((a, b) => dayOrder(a) - dayOrder(b))
    const concentratedGroups = groups.filter(g => g.groupType === "CONCENTRATED").sort((a, b) => dayOrder(a) - dayOrder(b))
    const maxReached = groups.length >= 14

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Supervision Group Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Max 1 Regular + 1 Concentrated per day — Maximum 14 groups total
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={maxReached ? "destructive" : "secondary"} className="h-7">
                        {groups.length} / 14 Groups
                    </Badge>
                    <Button
                        onClick={() => { setEditing(null); setDialogOpen(true) }}
                        disabled={maxReached}
                        className="rounded-xl shadow-lg border-2 border-white"
                        variant="gradient" // fallback to default if not available
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Group
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-3xl border border-dashed">
                    <Loader2 className="h-10 w-10 animate-spin mb-4 opacity-50" />
                    <p className="animate-pulse font-medium">Loading groups...</p>
                </div>
            ) : groups.length === 0 ? (
                <Card className="border-dashed py-20 flex flex-col items-center justify-center bg-muted/5">
                    <div className="bg-muted p-4 rounded-full mb-4">
                        <Users className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground font-medium">No groups created yet.</p>
                    <Button variant="link" onClick={() => setDialogOpen(true)} className="mt-2">
                        Create the first group
                    </Button>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Regular Groups */}
                    {regularGroups.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Regular Groups</h3>
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{regularGroups.length} / 7</Badge>
                            </div>
                            <div className="space-y-3">
                                {regularGroups.map(g => (
                                    <GroupCard
                                        key={g.id}
                                        group={g}
                                        allSupervisors={allSupervisors}
                                        onDelete={handleDelete}
                                        onAssign={handleAssign}
                                        onRemove={handleRemove}
                                        onEdit={g2 => { setEditing(g2); setDialogOpen(true) }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Concentrated Groups */}
                    {concentratedGroups.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-orange-500" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Concentrated Groups</h3>
                                <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">{concentratedGroups.length} / 7</Badge>
                            </div>
                            <div className="space-y-3">
                                {concentratedGroups.map(g => (
                                    <GroupCard
                                        key={g.id}
                                        group={g}
                                        allSupervisors={allSupervisors}
                                        onDelete={handleDelete}
                                        onAssign={handleAssign}
                                        onRemove={handleRemove}
                                        onEdit={g2 => { setEditing(g2); setDialogOpen(true) }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <GroupDialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); setEditing(null) }}
                onSave={handleCreate}
                existingGroups={groups}
                editing={editing}
            />
        </div>
    )
}
