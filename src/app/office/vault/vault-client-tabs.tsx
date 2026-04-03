"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldAlert, Eye, UploadCloud, History, HardDrive } from "lucide-react"
import { RecoverActionBtn } from "./recover-btn"
import { PurgeActionBtn } from "./purge-btn"
import { Button } from "@/components/ui/button"
import { ImportStaging } from "./import-staging"
import { ImportHistory } from "./import-history"
import { DbControlTab } from "./db-control"
import { useSession } from "next-auth/react"

export function VaultClientTabs({ hiddenUsers }: { hiddenUsers: any[] }) {
    const { data: session } = useSession()
    const isPurgeMaster = session?.user?.email === 'qa-super@abasystem.com'
    const isDbAdmin = session?.user?.email?.toLowerCase().trim() === 'qa-super@abasystem.com'

    return (
        <Tabs defaultValue="ghosts" className="w-full">
            <TabsList className={`grid w-full ${isDbAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="ghosts" className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Ghosted Accounts
                </TabsTrigger>
                <TabsTrigger value="import" className="flex items-center gap-2">
                    <UploadCloud className="h-4 w-4" />
                    Data Import Engine
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Import History
                </TabsTrigger>
                {isDbAdmin && (
                    <TabsTrigger value="dbcontrol" className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        DB Control
                    </TabsTrigger>
                )}
            </TabsList>

            <TabsContent value="ghosts" className="mt-6">
                <div className="grid gap-6">
                    {hiddenUsers.length === 0 ? (
                        <Card className="border-dashed shadow-none">
                            <CardContent className="flex flex-col items-center justify-center p-12">
                                <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground">The vault is currently empty.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        hiddenUsers.map((user) => {
                            let type: "student" | "supervisor" | "office" = "office"
                            let name = "Unknown"
                            let id = ""

                            if (user.student) {
                                type = "student"
                                name = user.student.fullName
                                id = user.student.id
                            } else if (user.supervisor) {
                                type = "supervisor"
                                name = user.supervisor.fullName
                                id = user.supervisor.id
                            } else if (user.officeMember) {
                                type = "office"
                                name = user.officeMember.fullName
                                id = user.officeMember.id
                            }

                            return (
                                <Card key={user.id} className="border-destructive/20 relative overflow-hidden group hover:border-destructive/40 transition-colors shadow-sm">
                                    <div className="absolute top-0 right-0 p-2 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider rounded-bl-xl border-b border-l border-destructive/20 pointer-events-none">
                                        Hidden {type}
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-destructive transition-colors">{name}</h3>
                                                <div className="flex items-center text-sm text-gray-500 gap-2 mt-1">
                                                    <span>{user.email}</span>
                                                    <span className="text-muted-foreground/30">•</span>
                                                    <span>Archived Account</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {type !== "office" && (
                                                    <a href={`/office/${type}s/${id}`}>
                                                        <Button variant="outline" size="sm" className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors">
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Profile
                                                        </Button>
                                                    </a>
                                                )}
                                                <RecoverActionBtn id={id} type={type} name={name} />
                                                {isPurgeMaster && (
                                                    <PurgeActionBtn 
                                                        userId={user.id} 
                                                        userName={name} 
                                                        userEmail={user.email} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </TabsContent>

            <TabsContent value="import" className="mt-6">
                <ImportStaging />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
                <ImportHistory />
            </TabsContent>

            {isDbAdmin && (
                <TabsContent value="dbcontrol" className="mt-6">
                    <DbControlTab />
                </TabsContent>
            )}
        </Tabs>
    )
}
