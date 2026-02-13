import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

export async function saveFileLocal(file: File, folder: string = "general"): Promise<{ url: string, path: string }> {
    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

    // Ensure directory exists
    const dir = path.join(UPLOAD_DIR, folder)
    try {
        await fs.access(dir)
    } catch {
        await fs.mkdir(dir, { recursive: true })
    }

    const filePath = path.join(dir, filename)
    await fs.writeFile(filePath, buffer)

    // Return URL relative to public
    return {
        url: `/uploads/${folder}/${filename}`,
        path: filePath
    }
}

export async function deleteFileLocal(fileUrl: string) {
    // fileUrl is like /uploads/folder/filename
    // We need to construct full path
    if (!fileUrl.startsWith("/uploads/")) return

    const relativePath = fileUrl.substring(1) // Remove leading /
    const fullPath = path.join(process.cwd(), "public", relativePath)

    try {
        await fs.unlink(fullPath)
    } catch (e) {
        console.error("Error deleting file:", e)
    }
}
