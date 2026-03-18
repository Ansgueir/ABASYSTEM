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
            // Check if supervisor is assigned to this student
            const isAssigned = await prisma.student.findFirst({
                where: { 
                    id: document.studentId || undefined,
                    supervisor: { userId: userId }
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
        
        // Try new path first (root level uploads)
        let filePath = path.resolve(process.cwd(), relativePath)
        
        if (!fs.existsSync(filePath)) {
            // Fallback to old path (inside public folder)
            const publicPath = path.resolve(process.cwd(), "public", relativePath)
            if (fs.existsSync(publicPath)) {
                filePath = publicPath
            } else {
                console.error(`[ERROR] File not found at resolved paths: ${filePath} OR ${publicPath}`)
                return new NextResponse("File not found on server", { status: 404 })
            }
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
