import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as xlsx from "xlsx"

export async function GET() {
    try {
        const students = await prisma.student.findMany({ include: { user: true, supervisor: true } })
        const supervisors = await prisma.supervisor.findMany({ include: { user: true } })

        const studentRows = students.map(s => ({
            "Original ID": s.paymentAlias?.[0] || "",
            "Student Name": s.fullName,
            "Supervisor Name": s.supervisor?.fullName || "",
            "BACB ID": s.bacbId,
            "Credential": s.credential,
            "School": s.school,
            "Level": s.level,
            "Phone": s.phone,
            "Email": s.email,
            "City": s.city,
            "State": s.state,
            "Start Date": s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : "",
            "Supervision Type": s.supervisionType,
            "Fieldwork Type": s.fieldworkType,
            "Supervision Percentage": s.supervisionPercentage ? Number(s.supervisionPercentage) : 0,
            "Hours Target Reg": s.hoursToDo ? Number(s.hoursToDo) : 0,
            "Total Amount Contract": s.amountToPay ? Number(s.amountToPay) : 0,
            "Academic Degree": s.academicDegree || "",
            "Status": s.status,
            "User ID": s.userId,
            "Student DB ID": s.id,
            "Password Assigned": "aba1234#" // Fixed standard password requested
        }))

        const supRows = supervisors.map(s => ({
            "Original ID": s.internalIdNumber || "",
            "Supervisor Name": s.fullName,
            "Phone": s.phone,
            "Email": s.email,
            "Address": s.address,
            "BACB ID": s.bacbId,
            "Certificant Number": s.certificantNumber,
            "Credential Type": s.credentialType,
            "Status": s.status,
            "User ID": s.userId,
            "Supervisor DB ID": s.id,
            "Password Assigned": "aba1234#" // Fixed standard password requested
        }))

        // create workbook
        const wb = xlsx.utils.book_new()
        const wsStud = xlsx.utils.json_to_sheet(studentRows)
        const wsSup = xlsx.utils.json_to_sheet(supRows)

        xlsx.utils.book_append_sheet(wb, wsStud, "Student")
        xlsx.utils.book_append_sheet(wb, wsSup, "Supervisor")

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" })

        return new NextResponse(buffer, {
            headers: {
                "Content-Disposition": "attachment; filename=DB_EXPORT_MAESTRA.xlsx",
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
