import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { serialize } from "@/lib/serialize"
import { SupervisorList } from "@/components/office/supervisor-list"

export default async function OfficeSupervisorsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") redirect("/login")
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN" || role === "QA"
    const isQaSuper = (session.user as any).email === "qa-super@abasystem.com"

    let supervisors: any[] = []

    try {
        supervisors = await prisma.supervisor.findMany({
            where: { user: { isHidden: false } },
            orderBy: { fullName: 'asc' },
            include: {
                _count: { select: { students: true, studentAssignments: { where: { isPrimary: false } } } },
                user: { select: { isActive: true, email: true } }
            }
        })
    } catch (error) {
        console.error("Error fetching supervisors:", error)
    }

    const safeSupervisors = serialize(supervisors)

    return (
        <DashboardLayout role="office">
            <SupervisorList initialSupervisors={safeSupervisors} isSuperAdmin={isSuperAdmin} isQaSuper={isQaSuper} />
        </DashboardLayout>
    )
}
