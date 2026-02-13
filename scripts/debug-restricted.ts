import { prisma } from "../src/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"
import { ActivityType } from "@prisma/client"

async function main() {
    console.log("--- Debugging Restricted Hours Check ---")
    const email = "qaestudiante@abasystem.com"

    const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true }
    })

    if (!user || !user.student) {
        console.error("User or Student profile not found for", email)
        return
    }

    const student = user.student
    console.log(`Student Found: ${student.fullName}`)
    console.log(`Level: ${student.level}`)
    console.log(`Student ID: ${student.id}`)

    const date = new Date() // Current month
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    console.log(`Checking period: ${start.toISOString()} to ${end.toISOString()}`)

    const independent = await prisma.independentHour.findMany({
        where: { studentId: student.id, date: { gte: start, lte: end } },
        select: { hours: true, activityType: true }
    })

    const supervision = await prisma.supervisionHour.findMany({
        where: { studentId: student.id, date: { gte: start, lte: end } },
        select: { hours: true, activityType: true }
    })

    let totalRestricted = 0
    let totalTotal = 0

    const sum = (hours: number, type: ActivityType) => {
        totalTotal += Number(hours)
        if (type === ActivityType.RESTRICTED) {
            totalRestricted += Number(hours)
        }
    }

    independent.forEach(h => sum(Number(h.hours), h.activityType))
    supervision.forEach(h => sum(Number(h.hours), h.activityType))

    // Note: This calculates based on CURRENT DB state (after the user already logged the hour)
    // The server action does (Existing + New), so it should match or be very close.

    const ratio = totalTotal > 0 ? totalRestricted / totalTotal : 0
    const percentage = ratio * 100

    console.log(`Total Hours: ${totalTotal}`)
    console.log(`Restricted Hours: ${totalRestricted}`)
    console.log(`Percentage: ${percentage.toFixed(2)}%`)

    if (student.level === "BCBA" && percentage > 40) {
        console.log("RESULT: SHOULD WARN (BCBA > 40%)")
    } else if (student.level === "BCaBA" && percentage > 60) {
        console.log("RESULT: SHOULD WARN (BCaBA > 60%)")
    } else {
        console.log("RESULT: NO WARNING")
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
