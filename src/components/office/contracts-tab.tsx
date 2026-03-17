"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users } from "lucide-react"

export function OfficeContractsTab({ studentId }: { studentId: string, contracts: any[], allSupervisors: any[] }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <Card>
            <CardHeader>
                <CardTitle>Supervision Contracts (Diagnostic Mode)</CardTitle>
                <CardDescription>
                    Checking for rendering errors. Student ID: {String(studentId || "N/A")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-xl bg-muted/10 text-center">
                    <Users className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="font-medium text-muted-foreground">Diagnostic View</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        If you see this, the container is safe.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
