import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { DocumentList } from "@/components/document-list"
import { DocumentType } from "@prisma/client"

export default async function SupervisorDocumentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    const supervisor = await prisma.supervisor.findUnique({
        where: { userId: session.user.id },
        include: { documents: true }
    })

    if (!supervisor) {
        return (
            <DashboardLayout role="supervisor">
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold text-destructive">Profile not found</h2>
                    <p>Please contact support.</p>
                </div>
            </DashboardLayout>
        )
    }

    // Sort documents by date desc
    const documents = supervisor.documents.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    const supervisorRequiredDocs = [
        { 
            type: DocumentType.BACB_CERTIFICATION, 
            label: "BACB Certification", 
            description: "Your official BCBA/BCaBA certification document." 
        },
        { 
            type: DocumentType.LIABILITY_INSURANCE, 
            label: "Liability Insurance", 
            description: "Current professional liability insurance policy." 
        },
        { 
            type: DocumentType.IDENTIFICATION, 
            label: "Identification", 
            description: "Official ID or Driver's License." 
        }
    ]

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Professional Documents</h1>
                    <p className="text-muted-foreground">
                        Manage your credentials and insurance documents.
                    </p>
                </div>

                <DocumentList 
                    documents={documents} 
                    requiredDocs={supervisorRequiredDocs}
                    title="Required Accreditations"
                    description="Please keep these documents up to date for your active supervision status."
                />
            </div>
        </DashboardLayout>
    )
}
