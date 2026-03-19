import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseISO, format, min, max } from "date-fns";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ studentId: string }> }
) {
    try {
        const { studentId } = await props.params;
        
        const session = await auth();
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const role = String((session.user as any).role).toLowerCase();
        if (role !== "supervisor" && role !== "student" && role !== "qa" && role !== "office") {
            return new NextResponse("Unauthorized role", { status: 401 });
        }

        const student: any = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                user: true,
                supervisors: {
                    include: { supervisor: { include: { user: true } } },
                    orderBy: { isPrimary: 'desc' }
                }
            }
        });

        const supervisorAssignments = student?.supervisors || [];
        const primaryAssignment = supervisorAssignments.find((a: any) => a.isPrimary);
        const primarySupervisor = primaryAssignment?.supervisor || null;

        if (!student || !primarySupervisor) {
            return new NextResponse("Student or primary supervisor not found", { status: 404 });
        }

        // For FVF (Final/Fieldwork Verification), we usually take ALL approved hours
        // or a range. For now, let's take all approved hours to represent the "Total Experience"
        const independentHours = await (prisma as any).independentHour.findMany({
            where: {
                studentId,
                status: "APPROVED"
            },
            orderBy: { date: 'asc' }
        });

        const supervisionHours = await (prisma as any).supervisionHour.findMany({
            where: {
                studentId,
                status: "APPROVED"
            },
            orderBy: { date: 'asc' }
        });

        if (independentHours.length === 0 && supervisionHours.length === 0) {
            // No hours yet, but we can still generate the form with names
        }

        const allDates = [...independentHours, ...supervisionHours].map(h => new Date(h.date));
        const startDate = allDates.length > 0 ? min(allDates) : new Date();
        const endDate = allDates.length > 0 ? max(allDates) : new Date();

        const totalIndependent = independentHours.reduce((sum: number, h: any) => sum + Number(h.hours), 0);
        const totalSupervised = supervisionHours.reduce((sum: number, h: any) => sum + Number(h.hours), 0);
        const totalExperienceHours = totalIndependent + totalSupervised;
        const supervisionPercentage = totalExperienceHours > 0 ? (totalSupervised / totalExperienceHours) * 100 : 0;

        // Load PDF Template
        const templatePath = path.join(process.cwd(), "public", "templates", "Fieldwork-Verification-Form.pdf");
        if (!fs.existsSync(templatePath)) {
            return new NextResponse("Template not found on server", { status: 404 });
        }
        const pdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();

        // Safe fill functions
        const trySetText = (fieldName: string, value: string) => {
            try {
                const field = form.getTextField(fieldName);
                if (field) field.setText(value);
            } catch (error) {
                console.warn(`Could not set field ${fieldName}`);
            }
        };

        const tryCheck = (fieldName: string) => {
            try {
                const field = form.getCheckBox(fieldName);
                if (field) field.check();
            } catch (error) {
                console.warn(`Could not check field ${fieldName}`);
            }
        };

        // Form Mappings (based on discovery)
        trySetText("TRAINEE_NAME", student.fullName);
        trySetText("TRAINEE_BACB_ID", student.bacbId || "");
        
        trySetText("START_DATE", format(startDate, "MM/dd/yyyy"));
        trySetText("END_DATE", format(endDate, "MM/dd/yyyy"));
        
        trySetText("TRAINEE_FIELDWORK_STATE", student.state || "FL");
        trySetText("TRAINEE_FIELDWORK_COUNTRY", "USA");

        // Fieldwork Type Checkbox
        tryCheck("CHECK_FIELDWORK"); // Supervised Fieldwork (usually the name for the checkbox)
        
        // Map up to 4 supervisors
        for (let i = 0; i < 4; i++) {
            const assignment = supervisorAssignments[i];
            const nameField = `SUPERVISOR_NAME_${i + 1}`;
            const idField = `SUPERVISOR_BACB_ID_${i + 1}`;

            if (assignment) {
                const s = assignment.supervisor;
                trySetText(nameField, s.fullName);
                trySetText(idField, s.certificantNumber || s.bacbId || "");
            } else {
                // Clear unused fields (important to remove hardcoded values in templates)
                trySetText(nameField, "");
                trySetText(idField, "");
            }
        }

        // Calculations
        trySetText("INDEPENDENT_HOURS", totalIndependent.toFixed(2));
        trySetText("SUPERVISED_HOURS", totalSupervised.toFixed(2));
        trySetText("TOTAL_FIELDWORK", totalExperienceHours.toFixed(2));
        trySetText("PERCENT_HOURS_SUPERVISED", supervisionPercentage.toFixed(1) + "%");

        // Responsible Supervisor
        trySetText("RESPONSIBLE_SUPERVISOR_NAME", primarySupervisor.fullName);
        trySetText("RESPONSIBLE_SUPERVISOR_ACCOUNT_ID", primarySupervisor.certificantNumber || primarySupervisor.bacbId || "");

        // Dates for Signatures
        const todayStr = format(new Date(), "MM/dd/yyyy");
        trySetText("SUPERVISOR_SIGNATURE_DATE", todayStr);

        // Signatures stamping
        const stampSignature = async (fieldName: string, imageUrl: string | null) => {
            if (!imageUrl) return;
            try {
                const sigField = form.getSignature(fieldName);
                const widgets = sigField.acroField.getWidgets();

                if (widgets.length > 0) {
                    const rect = form.getField(fieldName).acroField.getWidgets()[0].getRectangle();
                    const page = pdfDoc.getPages()[0];

                    let imgBytesToEmbed;
                    if (imageUrl.startsWith("data:image/")) {
                        const base64Data = imageUrl.split(',')[1];
                        imgBytesToEmbed = Buffer.from(base64Data, 'base64');
                    } else {
                        let sanitizedUrl = imageUrl;
                        if (sanitizedUrl.startsWith('/')) sanitizedUrl = sanitizedUrl.substring(1);
                        const localPath = path.join(process.cwd(), "public", sanitizedUrl);
                        if (fs.existsSync(localPath)) {
                            imgBytesToEmbed = fs.readFileSync(localPath);
                        }
                    }

                    if (imgBytesToEmbed) {
                        let image: any;
                        try {
                            image = await pdfDoc.embedPng(imgBytesToEmbed);
                        } catch (pngError) {
                            try {
                                image = await pdfDoc.embedJpg(imgBytesToEmbed);
                            } catch (e) {}
                        }

                        if (image) {
                            const dims = image.scale(1);
                            const targetHeight = 40;
                            const scaleFactor = targetHeight / dims.height;
                            const targetWidth = dims.width * scaleFactor;

                            page.drawImage(image, {
                                x: rect.x + 10, // Adjusted offset for FVF
                                y: rect.y - 12, // Lowered to sit on the line
                                width: Math.min(targetWidth, rect.width - 20),
                                height: targetHeight,
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`Error drawing signature for ${fieldName}:`, e);
            }
        };

        if (primarySupervisor.user.signatureUrl) {
            await stampSignature("SUPERVISOR_SIGNATURE", primarySupervisor.user.signatureUrl);
        }

        form.flatten();

        const pdfBytesOut = await pdfDoc.save();

        return new NextResponse(pdfBytesOut as any, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="Fieldwork-Verification-Form.pdf"`,
            },
        });
    } catch (error) {
        console.error("FVF Generation error:", error);
        return new NextResponse("Internal Server Error occurred generating the PDF.", { status: 500 });
    }
}
