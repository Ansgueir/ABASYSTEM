import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { spawn } from "child_process"
import { promises as fs } from "fs"
import path from "path"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"
const BACKUP_DIR = "/opt/aba-system/backups"

// Parse the DATABASE_URL to extract pg_dump params
function parseDatabaseUrl(url: string) {
    try {
        const u = new URL(url)
        return {
            host: u.hostname,
            port: u.port || "5432",
            user: u.username,
            password: u.password,
            database: u.pathname.replace("/", "")
        }
    } catch {
        return null
    }
}

export async function POST(req: Request) {
    // ── API FIREWALL ─────────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const customName: string = body.name?.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "backup"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const filename = `${customName}_${timestamp}.sql`

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || "")
    if (!dbConfig) {
        return NextResponse.json({ error: "Could not parse DATABASE_URL" }, { status: 500 })
    }

    // ── ASYNC SPAWN (non-blocking) ────────────────────────────────
    const env = { ...process.env, PGPASSWORD: dbConfig.password }

    const child = spawn(
        "pg_dump",
        [
            "-h", dbConfig.host,
            "-p", dbConfig.port,
            "-U", dbConfig.user,
            "-d", dbConfig.database,
            "-f", `${BACKUP_DIR}/${filename}`,
            "--no-password"
        ],
        { detached: true, stdio: "ignore", env }
    )

    child.unref() // fully decouple from the Node.js event loop

    return NextResponse.json({
        success: true,
        message: `Backup "${filename}" launched in background.`,
        filename
    })
}

export async function GET() {
    // ── API FIREWALL ─────────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        const files = await fs.readdir(BACKUP_DIR)
        const sqlFiles = files.filter(f => f.endsWith(".sql"))

        const fileDetails = await Promise.all(
            sqlFiles.map(async (file) => {
                const filePath = path.join(BACKUP_DIR, file)
                const stat = await fs.stat(filePath)
                return {
                    name: file,
                    sizeBytes: stat.size,
                    createdAt: stat.birthtime.toISOString(),
                    modifiedAt: stat.mtime.toISOString()
                }
            })
        )

        // Sort newest first
        fileDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return NextResponse.json({ success: true, backups: fileDetails })
    } catch (error: any) {
        // If the dir doesn't exist yet, return empty list
        if (error.code === "ENOENT") {
            return NextResponse.json({ success: true, backups: [] })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
