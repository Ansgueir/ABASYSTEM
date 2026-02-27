import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    const session = await auth()
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q") || ""

    if (query.length < 2) {
        return NextResponse.json({ results: [] })
    }

    try {
        const [students, supervisors, officeMembers] = await Promise.all([
            prisma.student.findMany({
                where: {
                    OR: [
                        { fullName: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                    ]
                },
                select: { id: true, fullName: true, email: true },
                take: 5
            }),
            prisma.supervisor.findMany({
                where: {
                    OR: [
                        { fullName: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                    ]
                },
                select: { id: true, fullName: true, email: true },
                take: 5
            }),
            prisma.officeMember.findMany({
                where: {
                    OR: [
                        { fullName: { contains: query, mode: 'insensitive' } },
                        { user: { email: { contains: query, mode: 'insensitive' } } },
                    ]
                },
                select: { id: true, fullName: true, user: { select: { email: true } } },
                take: 5
            })
        ])

        const formattedResults = [
            ...students.map(s => ({
                id: s.id,
                title: s.fullName,
                subtitle: s.email,
                type: "Student",
                url: `/office/students/${s.id}`
            })),
            ...supervisors.map(s => ({
                id: s.id,
                title: s.fullName,
                subtitle: s.email,
                type: "Supervisor",
                url: `/office/supervisors/${s.id}`
            })),
            ...officeMembers.map(s => ({
                id: s.id,
                title: s.fullName,
                subtitle: s.user.email,
                type: "Office Team",
                url: `/office/team` // Assuming there is a team page, or maybe just no specific URL
            }))
        ]

        return NextResponse.json({ results: formattedResults })
    } catch (error) {
        console.error("Search error:", error)
        return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }
}
