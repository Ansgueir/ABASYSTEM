import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { name, regHoursBcba, regHoursBcaba, concHours, totalCharge, analystPayout } = body

        const updatedPlan = await prisma.plan.update({
            where: { id: params.id },
            data: {
                name,
                regHoursBcba: Number(regHoursBcba),
                regHoursBcaba: Number(regHoursBcaba),
                concHours: Number(concHours),
                totalCharge,
                analystPayout
            }
        })

        return NextResponse.json({ success: true, plan: updatedPlan })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        await prisma.plan.delete({
            where: { id: params.id }
        })
        return NextResponse.json({ success: true, message: "Plan deleted successfully!" })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
