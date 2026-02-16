import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
        return NextResponse.json({ error: "Email parameter required" }, { status: 400 })
    }

    const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h1 style="color: #0070f3;">SMTP2GO Test</h1>
            <p>If you are seeing this email, the SMTP configuration is working correctly.</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
    `

    const result = await sendEmail({
        to: email,
        subject: "SMTP Connection Test",
        html
    })

    if (result.success) {
        return NextResponse.json({
            success: true,
            message: "Email sent successfully",
            details: result
        })
    } else {
        return NextResponse.json({
            success: false,
            error: "Failed to send email",
            details: result.error
        }, { status: 500 })
    }
}
