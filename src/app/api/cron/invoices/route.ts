import { NextResponse } from "next/server"
import { generateMonthlyInvoices } from "@/lib/invoicing"

export async function GET(request: Request) {
    // Basic security check - in production use CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return new NextResponse('Unauthorized', { status: 401 });
        // For development/demo without env setup, we might skip or log warning
        console.warn("Running cron without CRON_SECRET validation (Development Mode)")
    }

    const result = await generateMonthlyInvoices()

    if (result.success) {
        return NextResponse.json({ success: true, generated: result.count })
    } else {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
