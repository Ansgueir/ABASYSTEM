import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { StudentList } from "@/components/office/student-list"
import { serialize } from "@/lib/serialize"

export default async function OfficeStudentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") redirect("/login")

    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN" || role === "QA"
    const isQaSuper = (session.user as any).email === "qa-super@abasystem.com"
    let students: any[] = []

    try {
        const rawStudents = await prisma.student.findMany({
            where: { user: { isActive: true } },
            orderBy: { fullName: 'asc' },
            include: {
                supervisor: true,
                supervisors: {
                    include: { supervisor: true }
                },
                user: {
                    select: { isActive: true, email: true }
                },
                documents: { select: { documentType: true, status: true, fileName: true } },
                invoices: { select: { status: true, invoiceDate: true, amountDue: true, amountPaid: true } },
                supervisionHours: {
                    select: { date: true, hours: true },
                    orderBy: { date: 'desc' }
                }
            }
        })

        // Use the common serialize helper to handle Decimals, Dates, and nested objects
        students = serialize(rawStudents)
    } catch (error) {
        console.error("Error fetching students:", error)
    }

    return (
        <DashboardLayout role="office">
            <StudentList initialStudents={students} isSuperAdmin={isSuperAdmin} isQaSuper={isQaSuper} />
        </DashboardLayout>
    )
}
