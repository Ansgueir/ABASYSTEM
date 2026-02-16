import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id || id !== session.user.id) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        const role = (session.user as any).role?.toUpperCase()

        if (role === "STUDENT" || role === "QA") {
            const student = await prisma.student.findUnique({
                where: { userId: id },
                include: { supervisor: true }
            })
            return NextResponse.json(student)
        } else if (role === "SUPERVISOR") {
            const supervisor = await prisma.supervisor.findUnique({
                where: { userId: id }
            })
            return NextResponse.json(supervisor)
        } else if (role === "OFFICE") {
            const office = await prisma.officeMember.findUnique({
                where: { userId: id }
            })
            return NextResponse.json(office)
        }

        return new NextResponse("User profile not found", { status: 404 })
    } catch (error) {
        console.error("Profile API error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
