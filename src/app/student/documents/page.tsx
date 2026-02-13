import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { DocumentList } from "@/components/document-list"

export default async function StudentDocumentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "student" && role !== "qa") redirect("/login")

    const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        include: { documents: true }
    })

    if (!student) {
        return (
            <DashboardLayout role="student">
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold text-destructive">Profile not found</h2>
                    <p>Please contact support.</p>
                </div>
            </DashboardLayout>
        )
    }

    // Sort documents by date desc
    const documents = student.documents.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Documents</h1>
                    <p className="text-muted-foreground">
                        Manage your required documentation for supervision.
                    </p>
                </div>

                <DocumentList documents={documents} />
            </div>
        </DashboardLayout>
    )
}
