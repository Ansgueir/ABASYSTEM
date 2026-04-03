import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

export async function GET() {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const plans = await prisma.plan.findMany({
            orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json({ success: true, plans })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        // HARD LIMIT: Maximum 14 plans
        const planCount = await prisma.plan.count()
        if (planCount >= 14) {
            return NextResponse.json({ error: "Hard Limit reached: Maximum 14 plans allowed." }, { status: 400 })
        }

        const body = await req.json()
        const { name, regHoursBcba, regHoursBcaba, concHours, totalCharge, analystPayout, totalMonths } = body

        const newPlan = await prisma.plan.create({
            data: {
                name,
                regHoursBcba: Number(regHoursBcba),
                regHoursBcaba: Number(regHoursBcaba), // Note: user said both reg
                concHours: Number(concHours),
                totalCharge,
                analystPayout,
                totalMonths: Number(totalMonths) || 12
            }
        })

        return NextResponse.json({ success: true, plan: newPlan })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
