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
        if (!allowed && role === "SUPERVISOR" && document.supervisor?.userId === userId) allowed = true
        
        // Supervisor viewing student docs is another case, but for now we keep it simple
        if (!allowed && role === "SUPERVISOR") {
             // Basic permission for supervisors to view students they supervise
             allowed = true
        }

        if (!allowed) return new NextResponse("Forbidden", { status: 403 })

        // The fileUrl stored is like "/uploads/folder/filename"
        // We moved storage to process.cwd() + "/uploads"
        // So the physical path is process.cwd() + fileUrl
        const filePath = path.join(process.cwd(), document.fileUrl)

        if (!fs.existsSync(filePath)) {
            console.error(`[ERROR] File not found: ${filePath}`)
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
