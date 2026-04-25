import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as xlsx from "xlsx"

export async function GET() {
    try {
        const wb = xlsx.utils.book_new();

        // 1. STUDENTS TAB
        const students = await prisma.student.findMany({
            include: {
                user: true
            }
        });

        const studentRows = students.map(s => ({
            id: s.id,
            userId: s.userId,
            fullName: s.fullName,
            email: s.user.email,
            supervisorId: s.supervisorId || "",
            bacbId: s.bacbId,
            phone: s.phone,
            startDate: s.startDate.toISOString(),
            endDate: s.endDate.toISOString(),
            status: s.status,
            amountToPay: Number(s.amountToPay),
            hoursToDo: s.hoursToDo,
            hoursToPay: s.hoursToPay,
            hoursPerMonth: s.hoursPerMonth,
            totalMonths: s.totalMonths,
            credential: s.credential,
            school: s.school,
            level: s.level,
            city: s.city,
            state: s.state,
            supervisionType: s.supervisionType,
            fieldworkType: s.fieldworkType,
            supervisionPercentage: Number(s.supervisionPercentage),
            academicDegree: s.academicDegree || "",
            planTemplateId: "", // Not stored directly on student in current schema but can be placeholder
            assignedOptionPlan: ""
        }));

        const wsStudents = xlsx.utils.json_to_sheet(studentRows);
        xlsx.utils.book_append_sheet(wb, wsStudents, "STUDENTS");

        // 2. SUPERVISORS TAB
        const supervisors = await prisma.supervisor.findMany({
            include: {
                user: true
            }
        });

        const supervisorRows = supervisors.map(s => ({
            id: s.id,
            userId: s.userId,
            fullName: s.fullName,
            email: s.user.email,
            phone: s.phone,
            address: s.address,
            bacbId: s.bacbId,
            certificantNumber: s.certificantNumber,
            credentialType: s.credentialType
        }));

        const wsSupervisors = xlsx.utils.json_to_sheet(supervisorRows);
        xlsx.utils.book_append_sheet(wb, wsSupervisors, "SUPERVISORS");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Disposition": "attachment; filename=CARGA_MASIVA_CONSOLIDADA_ABA.xlsx",
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        });
    } catch (e: any) {
        console.error("[EXPORT ERROR]", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
