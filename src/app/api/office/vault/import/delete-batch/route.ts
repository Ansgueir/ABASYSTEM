/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * PURGA MANUAL (Delete Batch Log)
 * Elimina físicamente el lote y sus registros de auditoría (logs).
 * Esto destruye la capacidad de revertir una importación.
 */
export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        // §1 Security gateway
        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { batchId } = await request.json()
        if (!batchId) return new NextResponse("Missing batchId", { status: 400 })

        // Eliminar el lote (el cascade delete de logs debería estar activo, pero lo haremos manual si es necesario)
        // Según el esquema, logs tiene onDelete: Cascade
        await (prisma as any).importBatch.delete({
            where: { id: batchId }
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("[DELETE BATCH ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
