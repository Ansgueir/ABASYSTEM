"use client"

import { getGeneralSettings } from "@/actions/settings"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
    LayoutDashboard,
    Users,
    FileText,
    CreditCard,
    Settings,
    LogOut,
    Menu,
    X,
    GraduationCap,
    ChevronLeft,
    Bell,
    Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { GlobalSearch } from "./global-search"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notification-bell"

interface DashboardLayoutProps {
    children: React.ReactNode
    role?: "student" | "supervisor" | "office"
    rightPanel?: React.ReactNode
}

export default function DashboardLayout({
    children,
    role: initialRole = "student",
    rightPanel
}: DashboardLayoutProps) {
    const { data: session } = useSession()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [companyName, setCompanyName] = useState("ABA Supervision System")
    const pathname = usePathname()

    useEffect(() => {
        getGeneralSettings().then(res => {
            if (res.success && res.settings?.companyName) {
                setCompanyName(res.settings.companyName)
            }
        })
    }, [])

    // Use session role if available
    const userRole = (session?.user as any)?.role?.toLowerCase() || initialRole
    const officeRole = (session?.user as any)?.officeRole || null
    const userName = session?.user?.name || "User"
    const userEmail = session?.user?.email || ""
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()

    const routes = {
        student: [
            { name: "Dashboard", href: "/student", icon: LayoutDashboard },
            { name: "Timesheet", href: "/student/timesheet", icon: FileText },
            { name: "Contracts", href: "/student/contracts", icon: FileText },
            { name: "Payments", href: "/student/payments", icon: CreditCard },
            { name: "Documents", href: "/student/documents", icon: FileText },
            { name: "Profile", href: "/student/profile", icon: Users },
        ],
        supervisor: [
            { name: "Dashboard", href: "/supervisor", icon: LayoutDashboard },
            { name: "My Students", href: "/supervisor/students", icon: Users },
            { name: "Timesheet Entry", href: "/supervisor/timesheet", icon: FileText },
            { name: "Payments", href: "/supervisor/payments", icon: CreditCard },
            { name: "Profile", href: "/supervisor/profile", icon: Settings },
        ],
        office: [
            { name: "Dashboard", href: "/office", icon: LayoutDashboard },
            { name: "Students", href: "/office/students", icon: GraduationCap },
            { name: "Supervisors", href: "/office/supervisors", icon: Users },
            { name: "Review Logs", href: "/office/supervision-logs", icon: FileText },
            { name: "Payments", href: "/office/payments", icon: CreditCard },
            { name: "Group Supervision", href: "/office/group-supervision", icon: Users },
            { name: "Team", href: "/office/team", icon: Users },
            ...(officeRole === "SUPER_ADMIN" ? [{ name: "Settings", href: "/office/settings", icon: Settings }] : []),
        ]
    }

    const currentRoutes = routes[userRole as keyof typeof routes] || routes.student

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-sm">
                <div className="flex items-center gap-3">
                    <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-72 bg-card p-0">
                            <SidebarContent
                                routes={currentRoutes}
                                pathname={pathname}
                                collapsed={false}
                                onToggleCollapse={undefined}
                                onClose={() => setIsSidebarOpen(false)}
                                user={{ name: userName, role: userRole, avatar: initials }}
                                companyName={companyName}
                            />
                        </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-semibold text-foreground truncate max-w-[150px]">{companyName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <Link href={`/${userRole}/profile`}>
                        <Avatar className="h-9 w-9 border-2 border-primary/20">
                            {session?.user?.image && <AvatarImage src={session.user.image} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </header>

            <div className="flex">
                {/* Desktop Sidebar */}
                <aside className={cn(
                    "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-card border-r border-border z-40 transition-all duration-300",
                    isSidebarCollapsed ? "w-20" : "w-64"
                )}>
                    <SidebarContent
                        routes={currentRoutes}
                        pathname={pathname}
                        collapsed={isSidebarCollapsed}
                        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        user={{ name: userName, role: userRole, avatar: initials }}
                        companyName={companyName}
                    />
                </aside>

                {/* Main Content Area */}
                <div className={cn(
                    "flex-1 min-h-screen transition-all duration-300",
                    isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
                )}>
                    {/* Desktop Top Bar */}
                    <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-card border-b border-border sticky top-0 z-30">
                        <div className="flex items-center gap-4 flex-1 max-w-xl relative">
                            <GlobalSearch />
                        </div>
                        <div className="flex items-center gap-3">
                            <NotificationBell />
                            <Link href={`/${userRole}/profile`} className="flex items-center gap-3 pl-3 border-l border-border hover:opacity-80 transition-opacity">
                                <div className="text-right">
                                    <p className="text-sm font-medium">{userName}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                                </div>
                                <Avatar className="h-10 w-10 border-2 border-primary/20">
                                    {session?.user?.image && <AvatarImage src={session.user.image} />}
                                    <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                                </Avatar>
                            </Link>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="flex">
                        <main className={cn(
                            "flex-1 p-4 lg:p-8",
                            rightPanel && "xl:pr-4"
                        )}>
                            <div className="mx-auto max-w-5xl animate-fade-in">
                                {children}
                            </div>
                        </main>

                        {/* Right Panel (Desktop only) */}
                        {rightPanel && (
                            <aside className="hidden xl:block w-80 p-4 lg:p-6 border-l border-border bg-card/50 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
                                <div className="animate-slide-in-right">
                                    {rightPanel}
                                </div>
                            </aside>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

interface SidebarContentProps {
    routes: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }> }>
    pathname: string
    collapsed: boolean
    onToggleCollapse?: () => void
    onClose?: () => void
    user: {
        name: string
        role: string
        avatar: string
    }
    companyName: string
}

function SidebarContent({ routes, pathname, collapsed, onToggleCollapse, onClose, user, companyName }: SidebarContentProps) {
    const splitName = companyName.split(" ")
    const firstWord = splitName[0]
    const remainingWords = splitName.slice(1).join(" ")

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={cn(
                "flex items-center h-[73px] px-4 border-b border-border",
                collapsed ? "justify-center" : "justify-between"
            )}>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft shrink-0">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col leading-tight pt-1">
                            <div className="truncate w-full max-w-[140px]" title={companyName}>
                                <span className="font-bold text-base text-foreground">{firstWord}</span>
                                <span className="font-light text-base text-muted-foreground ml-1">{remainingWords}</span>
                            </div>
                        </div>
                    )}
                </div>
                {!collapsed && onToggleCollapse && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl hidden lg:flex"
                        onClick={onToggleCollapse}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                {!collapsed && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-4">
                        Overview
                    </p>
                )}
                {routes.map((route) => {
                    const Icon = route.icon
                    const isActive = pathname === route.href

                    return (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                                collapsed && "justify-center px-2",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title={collapsed ? route.name : undefined}
                        >
                            <Icon className={cn(
                                "h-5 w-5 flex-shrink-0",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )} />
                            {!collapsed && route.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className={cn(
                "p-4 border-t border-border",
                collapsed && "flex flex-col items-center"
            )}>
                {!collapsed && (
                    <Link
                        href={`/${user.role}/profile`}
                        onClick={onClose}
                        className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">{user.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                        </div>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    className={cn(
                        "text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl",
                        collapsed ? "w-10 h-10 p-0" : "w-full justify-start"
                    )}
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
                    {!collapsed && "Log Out"}
                </Button>
            </div>
        </div>
    )
}
