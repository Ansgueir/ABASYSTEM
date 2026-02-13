"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
    children: React.ReactNode
    role?: "student" | "supervisor" | "office"
    rightPanel?: React.ReactNode
}

export default function DashboardLayout({
    children,
    role = "student",
    rightPanel
}: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const pathname = usePathname()

    const routes = {
        student: [
            { name: "Dashboard", href: "/student", icon: LayoutDashboard },
            { name: "Timesheet", href: "/student/timesheet", icon: FileText },
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
            { name: "Payments", href: "/office/payments", icon: CreditCard },
            { name: "Group Supervision", href: "/office/group-supervision", icon: Users },
            { name: "Settings", href: "/office/settings", icon: Settings },
        ]
    }

    const currentRoutes = routes[role]

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
                                onClose={() => setIsSidebarOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">ABA System</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
                    </Button>
                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarImage src="/placeholder-user.jpg" />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">JD</AvatarFallback>
                    </Avatar>
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
                    />
                </aside>

                {/* Main Content Area */}
                <div className={cn(
                    "flex-1 min-h-screen transition-all duration-300",
                    isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
                )}>
                    {/* Desktop Top Bar */}
                    <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-card border-b border-border sticky top-0 z-30">
                        <div className="flex items-center gap-4 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search..."
                                    className="pl-10 bg-background"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="rounded-xl relative">
                                <Bell className="h-5 w-5" />
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                            </Button>
                            <div className="flex items-center gap-3 pl-3 border-l border-border">
                                <div className="text-right">
                                    <p className="text-sm font-medium">John Doe</p>
                                    <p className="text-xs text-muted-foreground">Student</p>
                                </div>
                                <Avatar className="h-10 w-10 border-2 border-primary/20">
                                    <AvatarImage src="/placeholder-user.jpg" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-medium">JD</AvatarFallback>
                                </Avatar>
                            </div>
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
}

function SidebarContent({ routes, pathname, collapsed, onToggleCollapse, onClose }: SidebarContentProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={cn(
                "flex items-center h-[73px] px-4 border-b border-border",
                collapsed ? "justify-center" : "justify-between"
            )}>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    {!collapsed && (
                        <div>
                            <span className="font-bold text-lg text-foreground">ABA</span>
                            <span className="font-light text-lg text-muted-foreground ml-1">System</span>
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
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50">
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarImage src="/placeholder-user.jpg" />
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">JD</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">John Doe</p>
                            <p className="text-xs text-muted-foreground">Student</p>
                        </div>
                    </div>
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
