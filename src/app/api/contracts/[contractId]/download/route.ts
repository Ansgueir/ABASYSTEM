import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { ContractPDF } from "@/components/pdf/contract-pdf"
import React from "react"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ contractId: string }> }
) {
    const { contractId } = await params

    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = String((session.user as any).role).toLowerCase()
    if (!["office", "supervisor", "qa"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch contract with all needed data using any to avoid stale Prisma type issues post-migration
    const contract = await (prisma as any).contract.findUnique({
        where: { id: contractId },
        include: {
            student: {
                include: { user: true }
            },
            supervisors: {
                include: {
                    supervisor: { include: { user: true } }
                }
            }
        }
    })

    if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

    // Fetch clinic settings
    const settings = await prisma.generalValues.findFirst()

    const trainee = {
        name: contract.student.fullName as string,
        role: "TRAINEE" as const,
        bacbId: contract.student.bacbId ?? "",
        signatureUrl: (contract.student.user.signatureUrl ?? undefined) as string | undefined,
    }

    const supervisors = contract.supervisors.map((cs: any) => ({
        name: cs.supervisor.fullName as string,
        role: (cs.supervisor.credentialType ?? "BCBA") as "BCBA" | "BCaBA",
        bacbId: cs.supervisor.bacbId ?? "",
        signatureUrl: (cs.supervisor.user.signatureUrl ?? undefined) as string | undefined,
        isMain: cs.isMainSupervisor as boolean,
    }))

    const clinic = {
        name: settings?.companyName ?? "ABA PLC",
        address: settings?.companyAddress ?? "1800 W 68th ST Suite 130, Hialeah, FL 33018",
        phone: settings?.companyPhone ?? "(305) 549-8770",
        email: settings?.companyEmail ?? "info@abaplc.com",
        website: (settings as any)?.companyWebsite ?? "www.abaplc.com",
    }

    const pdfBuffer = await renderToBuffer(
        React.createElement(ContractPDF as any, {
            trainee,
            supervisors,
            effectiveDate: contract.effectiveDate,
            clinic,
        })
    )

    const studentName = (contract.student.fullName as string).replace(/\s+/g, "_")
    const filename = `ABA_Contract_${studentName}_${contractId.slice(0, 8)}.pdf`

    // Convert Node.js Buffer to Uint8Array for NextResponse compatibility
    const uint8 = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    })
}
