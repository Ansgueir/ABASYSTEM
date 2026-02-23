"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"

const generateTempPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
}

const getSessionUser = async () => {
    const session = await auth()
    if (!session?.user) return null
    return {
        id: session.user.id,
        role: (session.user as any).role,
        officeRole: (session.user as any).officeRole
    }
}

export async function createStudent(formData: FormData) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string
    const bacbId = formData.get("bacbId") as string
    const city = formData.get("city") as string
    const state = formData.get("state") as string
    const school = formData.get("school") as string
    const supervisionType = formData.get("supervisionType") as any
    const startDate = new Date(formData.get("startDate") as string)
    const endDate = new Date(formData.get("endDate") as string)

    // Additional mandatory fields
    const hoursPerMonth = Number(formData.get("hoursPerMonth")) || 130
    const totalMonths = Number(formData.get("totalMonths")) || 12
    const supervisionPercentage = Number(formData.get("supervisionPercentage")) || 5
    const hoursToDo = Number(formData.get("hoursToDo")) || 2000
    const hoursToPay = Number(formData.get("hoursToPay")) || 2000
    const amountToPay = Number(formData.get("amountToPay")) || 1500

    // Only super_admin can set hourlyRate
    const isSuperAdmin = currentUser.officeRole === "SUPER_ADMIN"
    const hourlyRate = isSuperAdmin ? (parseFloat(formData.get("hourlyRate") as string) || 0) : 0

    if (!email || !fullName) {
        return { error: "Missing required fields" }
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) return { error: "User with this email already exists" }

        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    role: "STUDENT",
                    isFirstLogin: true,
                    onboardingCompleted: false
                }
            })

            await tx.student.create({
                data: {
                    userId: user.id,
                    fullName,
                    email,
                    phone,
                    bacbId: bacbId || "PENDING",
                    city: city || "Unknown",
                    state: state || "Unknown",
                    school: school || "Unknown",
                    credential: "RBT",
                    level: "BCBA",
                    supervisionType: supervisionType || "REGULAR",
                    startDate,
                    endDate,
                    hoursPerMonth,
                    totalMonths,
                    supervisionPercentage,
                    hoursToDo,
                    hoursToPay,
                    amountToPay,
                    hourlyRate,
                    availableDaysGroup: [],
                    paymentAlias: []
                }
            })
        })

        const settings = await prisma.generalValues.findFirst()
        const companyName = settings?.companyName || "Our Clinic"

        await sendEmail({
            to: email,
            subject: `Welcome to ${companyName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome, ${fullName}!</h2>
                    <p>You have been registered as a <strong>Student</strong> in the ${companyName}.</p>
                    <p>Your journey to certification starts here.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                    </div>

                    <p>Please log in and complete your onboarding process. You will be asked to change your password immediately.</p>
                    
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                       style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Access System
                    </a>
                </div>
            `
        })

        revalidatePath("/office/students")
        return { success: true }
    } catch (error) {
        console.error("Failed to create student:", error)
        return { error: "Failed to create student" }
    }
}

export async function createSupervisor(formData: FormData) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string
    const bacbId = formData.get("bacbId") as string
    const certificantNumber = formData.get("certificantNumber") as string
    const address = formData.get("address") as string
    const maxStudents = Number(formData.get("maxStudents")) || 10
    const paymentPercentage = Number(formData.get("paymentPercentage")) || 0.54

    if (!email || !fullName) return { error: "Missing required fields" }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) return { error: "User with this email already exists" }

        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    role: "SUPERVISOR",
                    isFirstLogin: true,
                    onboardingCompleted: false
                }
            })

            await tx.supervisor.create({
                data: {
                    userId: user.id,
                    fullName,
                    email,
                    phone,
                    address: address || "Unknown",
                    bacbId: bacbId || "PENDING",
                    certificantNumber: certificantNumber || "PENDING",
                    maxStudents,
                    paymentPercentage,
                    availableDaysGroup: []
                }
            })
        })

        const settings = await prisma.generalValues.findFirst()
        const companyName = settings?.companyName || "Our Clinic"

        await sendEmail({
            to: email,
            subject: `Welcome to ${companyName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome, ${fullName}!</h2>
                    <p>You have been registered as a <strong>Supervisor</strong> in the ${companyName}.</p>
                    <p>Please log in to manage your assigned students.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                    </div>

                    <p>Please log in and complete your onboarding process. You will be asked to change your password immediately.</p>
                    
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                       style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Access System
                    </a>
                </div>
            `
        })

        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        console.error("Failed to create supervisor:", error)
        return { error: "Failed to create supervisor" }
    }
}


export async function toggleUserStatus(userId: string, currentStatus: boolean, roleType: "USER" | "OFFICE" = "USER") {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    // Hierarchy check
    if (roleType === "OFFICE") {
        if (currentUser.officeRole !== "SUPER_ADMIN") {
            return { error: "Only Super Admin can manage Office staff status" }
        }
        // Prevent disabling self
        if (userId === currentUser.id) {
            return { error: "Cannot disable your own account" }
        }
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { isActive: !currentStatus }
        })
        revalidatePath("/office") // Revalidate broadly or specific paths
        return { success: true }
    } catch (error) {
        return { error: "Failed to update status" }
    }
}

export async function resetUserPassword(userId: string, email: string, name: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    // Optional: Add hierarchy check if target user is OFFICE level
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, include: { officeMember: true } })
    if (targetUser?.role === "OFFICE") {
        if (currentUser.officeRole !== "SUPER_ADMIN") {
            return { error: "Only Super Admin can reset Office staff passwords" }
        }
    }

    try {
        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: hashedPassword,
                isFirstLogin: true
            }
        })

        const settings = await prisma.generalValues.findFirst()
        const companyName = settings?.companyName || "Our Clinic"

        await sendEmail({
            to: email,
            subject: `Password Reset - ${companyName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset</h2>
                    <p>Hello ${name},</p>
                    <p>Your password has been reset by an administrator.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>New Temporary Password:</strong> ${tempPassword}</p>
                    </div>

                    <p>Please log in immediately and change this password.</p>
                    
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                       style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Login Now
                    </a>
                </div>
            `
        })

        return { success: true }
    } catch (error) {
        return { error: "Failed to reset password" }
    }
}

export async function deleteStudent(studentId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const student = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } })
        if (!student) return { error: "Student not found" }

        await prisma.$transaction(async (tx) => {
            await tx.student.delete({ where: { id: studentId } })
            await tx.user.delete({ where: { id: student.userId } })
        })

        revalidatePath("/office/students")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete student" }
    }
}

export async function deleteSupervisor(supervisorId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { userId: true } })
        if (!supervisor) return { error: "Supervisor not found" }

        await prisma.$transaction(async (tx) => {
            await tx.supervisor.delete({ where: { id: supervisorId } })
            await tx.user.delete({ where: { id: supervisor.userId } })
        })

        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete supervisor" }
    }
}

export async function createOfficeMember(formData: FormData) {
    const currentUser = await getSessionUser()
    // Only SUPER_ADMIN can create new office members
    if (!currentUser || currentUser.role !== "OFFICE" || currentUser.officeRole !== "SUPER_ADMIN") {
        return { error: "Unauthorized: Only Super Admin can create office members" }
    }

    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const officeRole = formData.get("officeRole") as "SUPER_ADMIN" | "ADMIN"

    if (!email || !fullName || !officeRole) {
        return { error: "Missing required fields" }
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) return { error: "User with this email already exists" }

        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    role: "OFFICE",
                    isFirstLogin: true,
                    onboardingCompleted: true // Office members might not need the student/supervisor onboarding wizard
                }
            })

            await tx.officeMember.create({
                data: {
                    userId: user.id,
                    fullName,
                    officeRole
                }
            })
        })

        const settings = await prisma.generalValues.findFirst()
        const companyName = settings?.companyName || "Our Clinic"

        await sendEmail({
            to: email,
            subject: `Welcome to ${companyName} - Admin Access`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome, ${fullName}!</h2>
                    <p>You have been granted <strong>${officeRole.replace("_", " ")}</strong> access to the ${companyName}.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                        <p style="margin: 0;"><strong>Role:</strong> ${officeRole}</p>
                    </div>

                    <p>Please log in immediately and change your password.</p>
                    
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                       style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Access Admin Panel
                    </a>
                </div>
            `
        })

        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        console.error("Failed to create office member:", error)
        return { error: "Failed to create office member" }
    }
}

export async function deleteOfficeMember(memberId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || currentUser.role !== "OFFICE" || currentUser.officeRole !== "SUPER_ADMIN") {
        return { error: "Unauthorized: Only Super Admin can delete office members" }
    }

    try {
        const member = await prisma.officeMember.findUnique({ where: { id: memberId }, select: { userId: true } })
        if (!member) return { error: "Member not found" }

        if (member.userId === currentUser.id) {
            return { error: "Cannot delete your own account" }
        }

        await prisma.$transaction(async (tx) => {
            await tx.officeMember.delete({ where: { id: memberId } })
            await tx.user.delete({ where: { id: member.userId } })
        })

        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete office member" }
    }
}

export async function updateStudent(studentId: string, data: any) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    // Strip hourlyRate if not SUPER_ADMIN
    const isSuperAdmin = currentUser.officeRole === "SUPER_ADMIN"
    if (!isSuperAdmin && data.hourlyRate !== undefined) {
        delete data.hourlyRate
    }

    try {
        await prisma.student.update({
            where: { id: studentId },
            data: data
        })
        revalidatePath(`/office/students/${studentId}`)
        revalidatePath("/office/students")
        revalidatePath("/office/payments")
        return { success: true }
    } catch (error) {
        console.error("Update student error:", error)
        return { error: "Failed to update student" }
    }
}

export async function updateSupervisor(supervisorId: string, data: any) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        await prisma.supervisor.update({
            where: { id: supervisorId },
            data: data
        })
        revalidatePath(`/office/supervisors/${supervisorId}`)
        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        console.error("Update supervisor error:", error)
        return { error: "Failed to update supervisor" }
    }
}

export async function updateOfficeMember(memberId: string, data: any) {
    const currentUser = await getSessionUser()
    if (!currentUser || currentUser.role !== "OFFICE" || currentUser.officeRole !== "SUPER_ADMIN") {
        return { error: "Unauthorized: Only Super Admin can edit office members" }
    }

    try {
        await prisma.officeMember.update({
            where: { id: memberId },
            data: data
        })
        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        console.error("Update office member error:", error)
        return { error: "Failed to update office member" }
    }
}
