import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ studentId: string }> }
) {
    try {
        const { studentId } = await props.params;
        const monthParam = request.nextUrl.searchParams.get("month");

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
                supervisor: { include: { user: true } }
            }
        });

        if (!student || !student.supervisor) {
            return new NextResponse("Student or supervisor not found", { status: 404 });
        }

        const targetDate = monthParam ? parseISO(`${monthParam}-01T12:00:00Z`) : new Date();
        const startDate = startOfMonth(targetDate);
        const endDate = endOfMonth(targetDate);

        const independentHours = await (prisma as any).independentHour.findMany({
            where: {
                studentId,
                status: "APPROVED",
                date: { gte: startDate, lte: endDate }
            }
        });

        const supervisionHours = await (prisma as any).supervisionHour.findMany({
            where: {
                studentId,
                status: "APPROVED",
                date: { gte: startDate, lte: endDate }
            }
        });

        const totalIndependent = independentHours.reduce((sum: number, h: any) => sum + Number(h.hours), 0);
        const totalSupervised = supervisionHours.reduce((sum: number, h: any) => sum + Number(h.hours), 0);
        const totalExperienceHours = totalIndependent + totalSupervised;
        const supervisionPercentage = totalExperienceHours > 0 ? (totalSupervised / totalExperienceHours) * 100 : 0;

        // Load PDF Template
        const templatePath = path.join(process.cwd(), "public", "templates", "Monthly-Form-Jan.pdf");
        const pdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();

        // Safe fill function avoiding crashes
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

        // Form Mappings
        trySetText("TRAINEE_NAME", student.fullName);
        trySetText("TRAINEE_BACB_ID", student.bacbId || "");

        // Ensure month/year is in desired format
        trySetText("TRAINEE_CERTIFICATE_MONTH/YEAR", format(targetDate, "MM/yyyy"));

        // Fieldwork Type
        try {
            const fieldworkField = form.getCheckBox("CHECK_SUPERVISED_FIELDWORK");
            if (fieldworkField) {
                const acroField = fieldworkField.acroField;
                const widgets = acroField.getWidgets();

                // Usually widgets[0] is Regular, widgets[1] is Concentrated
                const isConcentrated = student.fieldworkType === "CONCENTRATED";
                const targetWidget = widgets.find(w => {
                    const onVal = w.getOnValue()?.decodeText()?.toLowerCase();
                    return isConcentrated ? onVal?.includes("concentrated") : (!onVal?.includes("concentrated"));
                }) || widgets[isConcentrated ? 1 : 0];

                if (targetWidget && targetWidget.getOnValue && targetWidget.getOnValue()) {
                    const onValue = targetWidget.getOnValue()!;

                    // Force set the value in the acroField dictionary
                    acroField.dict.set(pdfDoc.context.obj("V"), onValue);
                    acroField.dict.set(pdfDoc.context.obj("AS"), onValue);

                    // Update appearance state for all widgets of this field
                    widgets.forEach(w => {
                        const wOnState = w.getOnValue();
                        if (wOnState) {
                            w.setAppearanceState(wOnState === onValue ? onValue : pdfDoc.context.obj("Off"));
                        }
                    });
                }
            }
        } catch (e) {
            console.warn(`Could not set Fieldwork Type checkboxes:`, e);
        }

        // Use the student's state as the clinic state, and default country
        trySetText("TRAINEE_FIELDWORK_STATE", student.state || "FL");
        trySetText("TRAINEE_FIELDWORK_COUNTRY", "USA");

        trySetText("RESPONSIBLE_SUPERVISOR_NAME", student.supervisor.fullName);
        trySetText("RESPONSIBLE_SUPERVISOR_BACB_ID", student.supervisor.bacbId || student.supervisor.certificantNumber || "");

        // Calculations
        trySetText("INDEPENDENT_HOURS", totalIndependent.toFixed(2));
        trySetText("SUPERVISED_HOURS", totalSupervised.toFixed(2));
        trySetText("TOTAL_FIELDWORK", totalExperienceHours.toFixed(2));
        trySetText("PERCENT_HOURS_SUPERVISED", supervisionPercentage.toFixed(1) + "%");

        // Prorated check
        const isProrated = (student.startDate > startDate && student.startDate <= endDate) ||
            (student.endDate && student.endDate < endDate && student.endDate >= startDate);
        if (isProrated) {
            tryCheck("This fieldwork included prorated hours for a partial month");
        }

        // Dates for Signatures
        const todayStr = format(new Date(), "MM/dd/yyyy");
        trySetText("SUPERVISOR_SIGNATURE_DATE", todayStr);
        trySetText("TRAINEE_SIGNATURE_DATE", todayStr);

        // Signatures stamping functionality
        const stampSignature = async (fieldName: string, imageUrl: string | null) => {
            if (!imageUrl) return;
            try {
                const sigField = form.getSignature(fieldName);
                const widgets = sigField.acroField.getWidgets();

                if (widgets.length > 0) {
                    const rect = form.getField(fieldName).acroField.getWidgets()[0].getRectangle();

                    // Simple page guessing approach:
                    const page = pdfDoc.getPages()[0];

                    let imgBytesToEmbed;
                    if (imageUrl.startsWith("data:image/")) {
                        const base64Data = imageUrl.split(',')[1];
                        imgBytesToEmbed = Buffer.from(base64Data, 'base64');
                    } else if (imageUrl.startsWith("http")) {
                        const res = await fetch(imageUrl);
                        if (!res.ok) throw new Error("Could not fetch image");
                        imgBytesToEmbed = await res.arrayBuffer();
                    } else {
                        // Relative local URL
                        let sanitizedUrl = imageUrl;
                        if (sanitizedUrl.startsWith('/')) {
                            sanitizedUrl = sanitizedUrl.substring(1);
                        }
                        const localPath = path.join(process.cwd(), "public", sanitizedUrl);
                        imgBytesToEmbed = fs.readFileSync(localPath);
                    }

                    let image: any;
                    if (imgBytesToEmbed) {
                        try {
                            image = await pdfDoc.embedPng(imgBytesToEmbed);
                        } catch (pngError) {
                            try {
                                image = await pdfDoc.embedJpg(imgBytesToEmbed);
                            } catch (jpgError) {
                                console.warn(`Could not embed image for ${fieldName} as PNG or JPG`);
                            }
                        }

                        if (image) {
                            const dims = image.scale(1);
                            // We aim for a ~40pt height instead of snapping to the tiny 13.9pt rect
                            const targetHeight = 40;
                            const scaleFactor = targetHeight / dims.height;
                            const targetWidth = dims.width * scaleFactor;

                            // Align above the line rect.y, avoid overflowing rect.width
                            page.drawImage(image, {
                                x: rect.x + 75,
                                y: rect.y + 2, // base line
                                width: Math.min(targetWidth, rect.width - 75),
                                height: targetHeight,
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`Error drawing signature for ${fieldName}:`, e);
            }
        };

        // Try to draw signatures if they exist in DB (user.signatureUrl)
        if (student.supervisor.user.signatureUrl) {
            await stampSignature("SUPERVISOR_SIGNATURE", student.supervisor.user.signatureUrl);
        }
        if (student.user.signatureUrl) {
            await stampSignature("TRAINEE_SIGNATURE", student.user.signatureUrl);
        }

        form.flatten(); // Lock the form

        const pdfBytesOut = await pdfDoc.save();

        return new NextResponse(pdfBytesOut as any, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="Monthly-Form-Jan.pdf"`,
            },
        });
    } catch (error) {
        console.error("MVF Generation error:", error);
        return new NextResponse("Internal Server Error occurred generating the PDF.", { status: 500 });
    }
}
