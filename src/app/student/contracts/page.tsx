import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { StudentContractsClient } from "@/components/student/contracts-client"
import { serialize } from "@/lib/serialize"

export default async function StudentContractsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "student" && role !== "qa") redirect("/login")

    const studentRecord = await prisma.student.findUnique({
        where: { userId: (session.user as any).id }
    })
    if (!studentRecord) {
        return (
            <DashboardLayout role="student">
                <div>Student record not found. Please contact administration.</div>
            </DashboardLayout>
        )
    }

    const contractsDate = await prisma.contract.findMany({
        where: { studentId: studentRecord.id },
        include: {
            supervisors: {
                include: {
                    supervisor: {
                        select: { fullName: true, credentialType: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    })

    const safeContracts = serialize(contractsDate)

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Supervision Contracts</h1>
                    <p className="text-muted-foreground">Review, download, and digitally sign your fieldwork supervision contracts.</p>
                </div>

                <StudentContractsClient contracts={safeContracts as any} />
            </div>
        </DashboardLayout>
    )
}
