import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

function isAuthorized(email: string, role: string, officeRole: string): boolean {
    if (email.toLowerCase().trim() === QA_SUPER_EMAIL) return true
    if (role === "OFFICE" && officeRole === "SUPER_ADMIN") return true
    return false
}

/** Computes the 5 auto-calculated fields from the 6 inputs */
function computePlanMath(inputs: {
    totalHours?: number
    hoursPerMonth?: number
    supervisedPercentage?: number
    hourlyRate?: number
    enrollmentFee?: number
}) {
    const { totalHours, hoursPerMonth, supervisedPercentage, hourlyRate, enrollmentFee } = inputs
    if (!totalHours || !hoursPerMonth || supervisedPercentage == null || !hourlyRate || enrollmentFee == null) {
        return { numberOfMonths: null, amountSupHours: null, totalCost: null, supervisionNet: null, monthlyPayment: null }
    }

    const numberOfMonths = Math.ceil(totalHours / hoursPerMonth)
    const amountSupHours = parseFloat((totalHours * supervisedPercentage).toFixed(4))
    const totalCost = parseFloat((amountSupHours * hourlyRate).toFixed(2))
    const supervisionNet = parseFloat((totalCost - enrollmentFee).toFixed(2))
    const monthlyPayment = numberOfMonths > 0 ? parseFloat((totalCost / numberOfMonths).toFixed(2)) : 0

    return { numberOfMonths, amountSupHours, totalCost, supervisionNet, monthlyPayment }
}

export async function GET() {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const plans = await prisma.plan.findMany({ orderBy: { createdAt: 'asc' } })
        return NextResponse.json({ success: true, plans })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await auth()
    const user = session?.user as any
    if (!user?.email || !isAuthorized(user.email, user.role, user.officeRole)) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        const planCount = await prisma.plan.count()
        if (planCount >= 14) {
            return NextResponse.json({ error: "Hard Limit reached: Maximum 14 plans allowed." }, { status: 400 })
        }

        const body = await req.json()
        const {
            name, fieldworkType,
            totalHours, hoursPerMonth, supervisedPercentage, hourlyRate, enrollmentFee, supervisorCommission,
            // legacy
            regHoursBcba, regHoursBcaba, concHours, totalMonths
        } = body

        const calc = computePlanMath({
            totalHours: totalHours ? Number(totalHours) : undefined,
            hoursPerMonth: hoursPerMonth ? Number(hoursPerMonth) : undefined,
            supervisedPercentage: supervisedPercentage != null ? Number(supervisedPercentage) : undefined,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
            enrollmentFee: enrollmentFee != null ? Number(enrollmentFee) : undefined,
        })

        const newPlan = await prisma.plan.create({
            data: {
                name,
                fieldworkType: fieldworkType || "REGULAR",
                // new inputs
                totalHours: totalHours ? Number(totalHours) : null,
                hoursPerMonth: hoursPerMonth ? Number(hoursPerMonth) : null,
                supervisedPercentage: supervisedPercentage != null ? Number(supervisedPercentage) : null,
                hourlyRate: hourlyRate ? Number(hourlyRate) : null,
                enrollmentFee: enrollmentFee != null ? Number(enrollmentFee) : null,
                supervisorCommission: supervisorCommission != null ? Number(supervisorCommission) : null,
                // auto-calculated snapshot
                numberOfMonths: calc.numberOfMonths,
                amountSupHours: calc.amountSupHours,
                totalCost: calc.totalCost,
                supervisionNet: calc.supervisionNet,
                monthlyPayment: calc.monthlyPayment,
                // legacy
                regHoursBcba: Number(regHoursBcba) || 0,
                regHoursBcaba: Number(regHoursBcaba) || 0,
                concHours: Number(concHours) || 0,
                totalCharge: calc.totalCost ?? 0,
                analystPayout: 0,
                totalMonths: calc.numberOfMonths ?? Number(totalMonths) ?? 12,
            } as any
        })

        return NextResponse.json({ success: true, plan: newPlan })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
