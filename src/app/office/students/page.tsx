import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { StudentList } from "@/components/office/student-list"

export default async function OfficeStudentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") redirect("/login")

    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN" || role === "QA"
    let students: any[] = []

    try {
        const rawStudents = await prisma.student.findMany({
            where: { user: { isActive: true } },
            orderBy: { fullName: 'asc' },
            include: {
                supervisor: true,
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

        // Convert Prisma Decimal objects to plain numbers for serialization to Client Component
        students = rawStudents.map(s => ({
            ...s,
            supervisionPercentage: s.supervisionPercentage ? Number(s.supervisionPercentage) : 0,
            amountToPay: s.amountToPay ? Number(s.amountToPay) : 0,
            hourlyRate: s.hourlyRate ? Number(s.hourlyRate) : 0,
            analystPaymentRate: s.analystPaymentRate ? Number(s.analystPaymentRate) : null,
            officePaymentRate: s.officePaymentRate ? Number(s.officePaymentRate) : null,
            totalAmountContract: s.totalAmountContract ? Number(s.totalAmountContract) : null,
        }))
    } catch (error) {
        console.error("Error fetching students:", error)
    }

    return (
        <DashboardLayout role="office">
            <StudentList initialStudents={students} isSuperAdmin={isSuperAdmin} />
        </DashboardLayout>
    )
}
