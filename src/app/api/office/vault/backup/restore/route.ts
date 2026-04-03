import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { spawn } from "child_process"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"
const BACKUP_DIR = "/opt/aba-system/backups"

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
    const filename: string = body.filename

    if (!filename || !filename.endsWith(".sql") || filename.includes("/") || filename.includes("..")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    }

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || "")
    if (!dbConfig) {
        return NextResponse.json({ error: "Could not parse DATABASE_URL" }, { status: 500 })
    }

    const filePath = `${BACKUP_DIR}/${filename}`
    const env = { ...process.env, PGPASSWORD: dbConfig.password }

    // ── NON-BLOCKING RESTORE ──────────────────────────────────────
    const child = spawn(
        "psql",
        [
            "-h", dbConfig.host,
            "-p", dbConfig.port,
            "-U", dbConfig.user,
            "-d", dbConfig.database,
            "-f", filePath,
            "--no-password"
        ],
        { detached: true, stdio: "ignore", env }
    )

    child.unref()

    return NextResponse.json({
        success: true,
        message: `Restore from "${filename}" launched in background. This may take a few seconds.`
    })
}
