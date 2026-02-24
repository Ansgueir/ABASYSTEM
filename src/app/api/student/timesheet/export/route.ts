import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import { TimesheetPDF } from "@/components/pdf/timesheet-pdf";
import React from 'react';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = String((session.user as any).role).toLowerCase();
        if (role !== "student" && role !== "qa") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            include: { user: true }
        });

        if (!student) {
            return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
        }

        // Fetch hours
        const [indepHours, supHours, indepTotal, supTotal] = await Promise.all([
            prisma.independentHour.findMany({
                where: { studentId: student.id },
                orderBy: { date: 'desc' }
            }),
            prisma.supervisionHour.findMany({
                where: { studentId: student.id },
                orderBy: { date: 'desc' },
                include: { supervisor: true }
            }),
            prisma.independentHour.aggregate({
                where: { studentId: student.id },
                _sum: { hours: true }
            }),
            prisma.supervisionHour.aggregate({
                where: { studentId: student.id },
                _sum: { hours: true }
            })
        ]);

        const hours = [
            ...indepHours.map((h: any) => ({ ...h, hours: Number(h.hours), type: 'independent' })),
            ...supHours.map((h: any) => ({ ...h, hours: Number(h.hours), type: 'supervised' }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const independentHoursSum = Number(indepTotal?._sum?.hours) || 0;
        const supervisedHoursSum = Number(supTotal?._sum?.hours) || 0;

        const stats = {
            independentHours: independentHoursSum,
            supervisedHours: supervisedHoursSum,
            totalProgress: independentHoursSum + supervisedHoursSum
        };

        // Generate PDF
        const stream = await renderToStream(React.createElement(TimesheetPDF, { student, hours, stats }) as any);

        return new NextResponse(stream as unknown as ReadableStream, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="timesheet_${student.fullName.replace(/\s+/g, "_")}.pdf"`,
            },
        });
    } catch (error) {
        console.error("Export timesheet error:", error);
        return NextResponse.json({ error: "Failed to generate timesheet PDF" }, { status: 500 });
    }
}
