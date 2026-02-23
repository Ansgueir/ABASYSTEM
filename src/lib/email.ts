import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.smtp2go.com",
    port: parseInt(process.env.SMTP_PORT || "2525"),
    secure: process.env.SMTP_SECURE === "true", // usually false for 2525
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
})

export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string
    subject: string
    html: string
}) {
    let fromName = process.env.SMTP_FROM_NAME
    if (!fromName) {
        try {
            const { prisma } = await import("@/lib/prisma")
            const gv = await prisma.generalValues.findFirst()
            fromName = gv?.companyName || "ABA Supervision System"
        } catch {
            fromName = "ABA Supervision System"
        }
    }
    const fromEmail = process.env.SMTP_FROM_EMAIL || "no-reply@abasystem.com"
    const from = `"${fromName}" <${fromEmail}>`

    // If no SMTP credentials, just log it (Dev Mode / Missing Config)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log("==================================================")
        console.log("📧 MOCK EMAIL SEND (No SMTP Configured)")
        console.log(`From: ${from}`)
        console.log(`To: ${to}`)
        console.log(`Subject: ${subject}`)
        console.log("--------------------------------------------------")
        // Preview content snippet
        console.log(html.substring(0, 200) + "...")
        console.log("==================================================")
        return { success: true, mock: true }
    }

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
        })

        if (process.env.NODE_ENV !== "production") {
            console.log(`📧 Email sent to ${to} via SMTP2GO. MessageId: ${info.messageId}`)
        }

        return { success: true, messageId: info.messageId }
    } catch (error) {
        console.error("❌ Error sending email:", error)
        return { success: false, error }
    }
}
