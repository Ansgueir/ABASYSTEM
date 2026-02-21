import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns"
import { PrintButton } from "@/components/supervisor/print-button"

export default async function GenerateMVFPage(
    props: { params: Promise<{ studentId: string }>, searchParams: Promise<{ month?: string }> }
) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const { studentId } = params;

    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "student" && role !== "qa") redirect("/login")

    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { supervisor: true }
    })

    if (!student || !student.supervisor) {
        return <div className="p-8 text-center text-red-600">Student or supervisor not found</div>
    }

    // Determine month to generate (default to current month if not provided)
    const targetDate = searchParams.month ? parseISO(`${searchParams.month}-01`) : new Date()
    const startDate = startOfMonth(targetDate)
    const endDate = endOfMonth(targetDate)

    const independentHours = await prisma.independentHour.findMany({
        where: {
            studentId,
            status: "APPROVED",
            date: { gte: startDate, lte: endDate }
        }
    })

    const supervisionHours = await prisma.supervisionHour.findMany({
        where: {
            studentId,
            status: "APPROVED",
            date: { gte: startDate, lte: endDate }
        }
    })

    const allHours = [...independentHours, ...supervisionHours]

    const totalIndependent = independentHours.reduce((sum, h) => sum + Number(h.hours), 0)
    const totalSupervised = supervisionHours.reduce((sum, h) => sum + Number(h.hours), 0)
    const groupHours = supervisionHours.filter(h => h.supervisionType === "GROUP").reduce((sum, h) => sum + Number(h.hours), 0)
    const individualHours = supervisionHours.filter(h => h.supervisionType === "INDIVIDUAL").reduce((sum, h) => sum + Number(h.hours), 0)

    const totalExperienceHours = totalIndependent + totalSupervised
    const supervisionPercentage = totalExperienceHours > 0 ? (totalSupervised / totalExperienceHours) * 100 : 0
    const meets5Percent = supervisionPercentage >= 5

    return (
        <div className="max-w-4xl mx-auto p-10 bg-white min-h-screen font-sans text-black" style={{ printColorAdjust: "exact" }}>
            <div className="flex justify-between items-center mb-8 no-print">
                <h1 className="text-2xl font-bold">Monthly Fieldwork Verification Form (MVF)</h1>
                <PrintButton />
            </div>

            <div className="border-4 border-black p-8">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold uppercase tracking-wider">Monthly Fieldwork Verification Form</h2>
                    <h3 className="text-lg font-semibold mt-2">BACB® Experience Standards</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8">
                    <div className="border-b-2 border-black pb-1">
                        <span className="font-bold text-sm uppercase">Trainee Name:</span>
                        <div className="text-lg">{student.fullName}</div>
                    </div>
                    <div className="border-b-2 border-black pb-1">
                        <span className="font-bold text-sm uppercase">BACB ID:</span>
                        <div className="text-lg">{student.bacbId || "N/A"}</div>
                    </div>

                    <div className="border-b-2 border-black pb-1">
                        <span className="font-bold text-sm uppercase">Supervisor Name:</span>
                        <div className="text-lg">{student.supervisor.fullName}</div>
                    </div>
                    <div className="border-b-2 border-black pb-1">
                        <span className="font-bold text-sm uppercase">Supervisor Certification #:</span>
                        <div className="text-lg">{student.supervisor.certificantNumber || "N/A"}</div>
                    </div>

                    <div className="border-b-2 border-black pb-1 col-span-2">
                        <span className="font-bold text-sm uppercase">Supervisory Period (Month/Year):</span>
                        <div className="text-lg">{format(targetDate, "MMMM yyyy")}</div>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="font-bold text-lg mb-2 border-b-2 border-black">Experience Hours</h4>
                    <table className="w-full text-left border-collapse">
                        <tbody>
                            <tr className="border-b border-gray-300">
                                <td className="py-2 w-3/4">Independent Hours (Unrestricted + Restricted)</td>
                                <td className="py-2 text-right font-mono text-lg">{totalIndependent.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-gray-300">
                                <td className="py-2">Supervised Hours (Individual + Group)</td>
                                <td className="py-2 text-right font-mono text-lg">{totalSupervised.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b-2 border-black bg-gray-50">
                                <td className="py-2 font-bold">Total Experience Hours for Period</td>
                                <td className="py-2 text-right font-bold font-mono text-xl">{totalExperienceHours.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mb-8">
                    <h4 className="font-bold text-lg mb-2 border-b-2 border-black">Supervision Summary</h4>
                    <table className="w-full text-left border-collapse">
                        <tbody>
                            <tr className="border-b border-gray-300">
                                <td className="py-2 w-3/4">Percentage of Hours Supervised (Must meet ~5%)</td>
                                <td className="py-2 text-right font-mono font-bold text-lg">
                                    <span className={meets5Percent ? "text-green-600" : "text-red-600"}>
                                        {supervisionPercentage.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b-2 border-black bg-gray-50">
                                <td className="py-2 font-bold">Total Group Supervision Hours</td>
                                <td className="py-2 text-right font-mono font-bold text-lg">{groupHours.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b-2 border-black bg-gray-50">
                                <td className="py-2 font-bold">Total Individual Supervision Hours</td>
                                <td className="py-2 text-right font-mono font-bold text-lg">{individualHours.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-gray-300">
                                <td className="py-2 font-bold text-red-600">Requirement Met: 5% Supervision?</td>
                                <td className="py-2 text-right font-bold text-lg uppercase">
                                    {meets5Percent ? "YES" : "NO"}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-8">
                    <div className="text-center">
                        <div className="border-b-2 border-black h-20 relative flex items-end justify-center pb-2">
                            <span className="text-blue-700 italic text-2xl" style={{ fontFamily: "cursive" }}>{student.fullName}</span>
                        </div>
                        <div className="mt-2 font-bold uppercase text-sm">Trainee Signature (Auto-Stampped)</div>
                        <div className="text-sm">{format(new Date(), "MM/dd/yyyy")}</div>
                    </div>

                    <div className="text-center">
                        <div className="border-b-2 border-black h-20 relative flex items-end justify-center pb-2">
                            <span className="text-blue-700 italic text-2xl" style={{ fontFamily: "cursive" }}>{student.supervisor.fullName}</span>
                        </div>
                        <div className="mt-2 font-bold uppercase text-sm">Supervisor Signature (Auto-Stampped)</div>
                        <div className="text-sm">{format(new Date(), "MM/dd/yyyy")}</div>
                    </div>
                </div>

                <div className="mt-8 text-xs text-gray-500 text-center uppercase tracking-widest border-t pt-4">
                    Generated automatically by ERP ABA Supervision System
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; }
                    @page { margin: 10mm; }
                }
            `}} />
        </div>
    )
}
