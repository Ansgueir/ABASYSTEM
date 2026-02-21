import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import OnboardingWizard from "@/components/onboarding/wizard"

export default async function OnboardingPage() {
    const session = await auth()

    // Safety check just in case middleware fails or direct access
    if (!session || !session.user) {
        console.error("[ONBOARDING] Missing session or user in Server Component", session);
        return <div className="p-8 text-center text-red-500 font-bold">Error: Session missing in Server Component. Please clear your cookies and login again.</div>;
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            student: true,
            supervisor: true
        }
    })

    if (!user) {
        console.error("[ONBOARDING] User ID not found in database:", session.user.id);
        return <div className="p-8 text-center text-red-500 font-bold">Error: User account not found in the database. Contact support.</div>;
    }

    // If already completed, redirect to role-specific dashboard
    if (user.onboardingCompleted) {
        const rolePath = user.role.toLowerCase()
        redirect(`/${rolePath}`)
    }

    // Prepare initial data for the form
    let initialData = {
        phone: "",
        address: "",
        fullName: "",
        email: user.email,
        role: user.role,
        step: user.onboardingStep
    }

    if (user.student) {
        initialData.phone = user.student.phone
        initialData.address = user.student.address
        initialData.fullName = user.student.fullName
    } else if (user.supervisor) {
        initialData.phone = user.supervisor.phone
        initialData.address = user.supervisor.address
        initialData.fullName = user.supervisor.fullName
    }

    // Default step should depend on DB state.
    // Step 0 -> Start at 1.
    // Step 1 -> Start at 1?
    // Step 2 -> Start at 2.
    // Step 3 -> Start at 3.
    // If step is 0 (initial), we treat as step 1.
    const currentStep = user.onboardingStep === 0 ? 1 : user.onboardingStep

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Welcome to ABA System
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Please complete the onboarding process to access your dashboard.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
                <OnboardingWizard initialStep={currentStep} initialData={initialData} />
            </div>
        </div>
    )
}
