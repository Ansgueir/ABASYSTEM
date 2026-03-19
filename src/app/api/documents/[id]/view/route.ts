import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import fs from "node:fs"
import path from "node:path"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const document = await prisma.document.findUnique({
            where: { id },
            include: { student: true, supervisor: true }
        })

        if (!document) return new NextResponse("Document not found", { status: 404 })

        const role = String((session.user as any).role).toUpperCase()
        const userId = (session.user as any).id

        let allowed = ["OFFICE", "QA"].includes(role)
        if (!allowed && role === "STUDENT" && document.student?.userId === userId) allowed = true
        
        // Supervisor viewing student docs
        if (!allowed && role === "SUPERVISOR") {
            // Check if supervisor is assigned to this student (Primary or via Pivot)
            const isAssigned = await prisma.student.findFirst({
                where: { 
                    id: document.studentId || undefined,
                    OR: [
                        { supervisor: { userId: userId } }, // Primary
                        { supervisors: { some: { supervisor: { userId: userId } } } } // Secondary/Pivot
                    ]
                }
            })
            if (isAssigned || document.supervisor?.userId === userId) {
                allowed = true
            }
        }

        if (!allowed) {
            console.warn(`[WARN] Access forbidden to document ${id} for user ${userId} with role ${role}`)
            return new NextResponse("Forbidden", { status: 403 })
        }

        const relativePath = document.fileUrl.startsWith("/") ? document.fileUrl.substring(1) : document.fileUrl
        
        // Comprehensive path resolution
        const possiblePaths = [
            path.resolve(process.cwd(), relativePath), // Relative to CWD (root uploads)
            path.join("/opt/aba-system", relativePath), // Hardcoded absolute (root uploads)
            path.resolve(process.cwd(), "public", relativePath), // Legacy public folder
            path.join("/opt/aba-system/public", relativePath) // Hardcoded absolute public
        ]

        let filePath = ""
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                filePath = p
                break
            }
        }

        if (!filePath) {
            console.error(`[CRITICAL ERROR] File not found for document ${id}. Tried: ${possiblePaths.join(" | ")}`)
            return new NextResponse("File not found on server", { status: 404 })
        }

        const fileBuffer = fs.readFileSync(filePath)
        
        let contentType = "application/octet-stream"
        const ext = path.extname(document.fileName).toLowerCase()
        if (ext === ".pdf") contentType = "application/pdf"
        else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
        else if (ext === ".png") contentType = "image/png"

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${document.fileName}"`,
                "Cache-Control": "private, max-age=3600"
            }
        })
    } catch (error) {
        console.error("[CRITICAL ERROR] Error serving document:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
