"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface NotificationItem {
    id: string
    title: string
    message: string
    isRead: boolean
    link?: string | null
    createdAt: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    useEffect(() => {
        fetchNotifications()
    }, [])

    async function fetchNotifications() {
        try {
            const res = await fetch("/api/notifications")
            const data = await res.json()
            if (Array.isArray(data)) {
                setNotifications(data)
                setUnreadCount(data.filter(n => !n.isRead).length)
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error)
        }
    }

    async function markAsRead(id: string) {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: "POST" })
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error("Failed to mark as read", error)
        }
    }

    async function markAllAsRead() {
        try {
            await fetch("/api/notifications/read-all", { method: "POST" })
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
        } catch (error) {
            console.error("Failed to mark all as read", error)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center animate-in zoom-in">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 shadow-lg border-primary/10">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">Notifications</p>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/5"
                            onClick={(e) => {
                                e.stopPropagation();
                                markAllAsRead();
                            }}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <Bell className="h-5 w-5 text-muted-foreground opacity-50" />
                            </div>
                            <p className="text-sm text-muted-foreground">Stay tuned! You'll see updates here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {notifications.map((n) => {
                                const content = (
                                    <>
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <p className={`text-sm tracking-tight leading-snug ${!n.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                                                {n.title}
                                            </p>
                                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />}
                                        </div>
                                        <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                            {n.message}
                                        </p>
                                        <p className="text-[10px] font-medium text-muted-foreground/60 mt-2.5 flex items-center gap-1.5">
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                        </p>
                                    </>
                                )

                                const className = `p-4 hover:bg-muted/40 transition-all duration-200 block ${!n.isRead ? "bg-primary/[0.03]" : ""}`

                                if (n.link) {
                                    return (
                                        <Link
                                            key={n.id}
                                            href={n.link}
                                            onClick={() => {
                                                if (!n.isRead) markAsRead(n.id)
                                                setOpen(false)
                                            }}
                                            className={className}
                                        >
                                            {content}
                                        </Link>
                                    )
                                }

                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => {
                                            if (!n.isRead) markAsRead(n.id)
                                        }}
                                        className={className}
                                    >
                                        {content}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
