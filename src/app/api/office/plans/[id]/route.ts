import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

function isAuthorized(email: string, role: string, officeRole: string): boolean {
    if (email.toLowerCase().trim() === QA_SUPER_EMAIL) return true
    if (role === "OFFICE" && officeRole === "SUPER_ADMIN") return true
    return false
}

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

export async function PATCH(req: Request, context: { params: any }) {
    const session = await auth()
    const user = session?.user as any
    if (!user?.email || !isAuthorized(user.email, user.role, user.officeRole)) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    const params = await context.params
    const id = params?.id
    if (!id) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })

    try {
        const body = await req.json()
        const {
            name, fieldworkType,
            totalHours, hoursPerMonth, supervisedPercentage, hourlyRate, enrollmentFee, supervisorCommission,
            individualSupervisedTarget, groupSupervisionTarget, individualSupervisedDelta, groupSupervisionDelta,
            regHoursBcba, regHoursBcaba, concHours, totalMonths
        } = body

        const calc = computePlanMath({
            totalHours: totalHours ? Number(totalHours) : undefined,
            hoursPerMonth: hoursPerMonth ? Number(hoursPerMonth) : undefined,
            supervisedPercentage: supervisedPercentage != null ? Number(supervisedPercentage) : undefined,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
            enrollmentFee: enrollmentFee != null ? Number(enrollmentFee) : undefined,
        })

        const updatedPlan = await prisma.plan.update({
            where: { id },
            data: {
                name,
                fieldworkType: fieldworkType || "REGULAR",
                totalHours: totalHours ? Number(totalHours) : null,
                hoursPerMonth: hoursPerMonth ? Number(hoursPerMonth) : null,
                supervisedPercentage: supervisedPercentage != null ? Number(supervisedPercentage) : null,
                hourlyRate: hourlyRate ? Number(hourlyRate) : null,
                enrollmentFee: enrollmentFee != null ? Number(enrollmentFee) : null,
                supervisorCommission: supervisorCommission != null ? Number(supervisorCommission) : null,
                individualSupervisedTarget: individualSupervisedTarget != null ? Number(individualSupervisedTarget) : null,
                groupSupervisionTarget: groupSupervisionTarget != null ? Number(groupSupervisionTarget) : null,
                individualSupervisedDelta: individualSupervisedDelta != null ? Number(individualSupervisedDelta) : null,
                groupSupervisionDelta: groupSupervisionDelta != null ? Number(groupSupervisionDelta) : null,
                numberOfMonths: calc.numberOfMonths,
                amountSupHours: calc.amountSupHours,
                totalCost: calc.totalCost,
                supervisionNet: calc.supervisionNet,
                monthlyPayment: calc.monthlyPayment,
                regHoursBcba: Number(regHoursBcba) || 0,
                regHoursBcaba: Number(regHoursBcaba) || 0,
                concHours: Number(concHours) || 0,
                totalCharge: calc.totalCost ?? 0,
                totalMonths: calc.numberOfMonths ?? Number(totalMonths) ?? 12,
            } as any
        })

        return NextResponse.json({ success: true, plan: updatedPlan })
    } catch (error: any) {
        console.error("Prisma update error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, context: { params: any }) {
    const session = await auth()
    const user = session?.user as any
    if (!user?.email || !isAuthorized(user.email, user.role, user.officeRole)) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    const params = await context.params
    const id = params?.id
    if (!id) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })

    try {
        await prisma.plan.delete({ where: { id } })
        return NextResponse.json({ success: true, message: "Plan deleted successfully!" })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
