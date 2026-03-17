"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit"

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
    const role = (session.user as any).role
    const officeRole = (session.user as any).officeRole
    return {
        id: session.user.id,
        email: session.user.email,
        role,
        officeRole,
        isSuperAdmin: officeRole === "SUPER_ADMIN" || role === "QA" || session.user.email?.toLowerCase() === "qa-super@abasystem.com"
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

    const vcsSequence = formData.get("vcsSequence") as string
    const assignedOptionPlan = formData.get("assignedOptionPlan") as any || null
    const totalAmountContract = Number(formData.get("totalAmountContract")) || null
    const analystPaymentRate = Number(formData.get("analystPaymentRate")) || null
    const officePaymentRate = Number(formData.get("officePaymentRate")) || null
    const regularHoursTarget = Number(formData.get("regularHoursTarget")) || null
    const concentratedHoursTarget = Number(formData.get("concentratedHoursTarget")) || null
    const independentHoursTarget = Number(formData.get("independentHoursTarget")) || null
    const internalComments = formData.get("internalComments") as string

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

        let createdStudent: any = null
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

            createdStudent = await tx.student.create({
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
                    paymentAlias: [],
                    vcsSequence: vcsSequence || null,
                    assignedOptionPlan: assignedOptionPlan || null,
                    totalAmountContract,
                    analystPaymentRate,
                    officePaymentRate,
                    regularHoursTarget,
                    concentratedHoursTarget,
                    independentHoursTarget,
                    internalComments: internalComments || null
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

        await logAudit({
            action: "CREATE",
            entity: "Student",
            entityId: createdStudent?.id,
            details: `Created new student: ${createdStudent?.fullName}`,
            newValues: createdStudent
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
    const internalIdNumber = formData.get("internalIdNumber") as string
    const credentialType = formData.get("qualificationLevel") as any || "BCBA"
    const dateQualifiedStr = formData.get("dateQualified") as string
    const examDateStr = formData.get("examDate") as string
    const address = formData.get("address") as string
    const maxStudents = Number(formData.get("maxStudents")) || 10
    const paymentPercentage = Number(formData.get("paymentPercentage")) || 0.54

    if (!email || !fullName) return { error: "Missing required fields" }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) return { error: "User with this email already exists" }

        const tempPassword = generateTempPassword()
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        let createdSupervisor: any = null
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

            createdSupervisor = await tx.supervisor.create({
                data: {
                    userId: user.id,
                    fullName,
                    email,
                    phone,
                    address: address || "Unknown",
                    bacbId: bacbId || "PENDING",
                    certificantNumber: certificantNumber || "PENDING",
                    internalIdNumber: internalIdNumber || null,
                    credentialType,
                    dateQualified: dateQualifiedStr ? new Date(dateQualifiedStr) : null,
                    examDate: examDateStr ? new Date(examDateStr) : null,
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

        await logAudit({
            action: "CREATE",
            entity: "Supervisor",
            entityId: createdSupervisor?.id,
            details: `Created new supervisor: ${createdSupervisor?.fullName}`,
            newValues: createdSupervisor
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
            await tx.student.update({
                where: { id: studentId },
                data: { status: "DISABLED" }
            })
            await tx.user.update({
                where: { id: student.userId },
                data: { isHidden: true, isActive: false }
            })
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
            await tx.supervisor.update({
                where: { id: supervisorId },
                data: { status: "DISABLED" }
            })
            await tx.user.update({
                where: { id: supervisor.userId },
                data: { isHidden: true, isActive: false }
            })
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
            await tx.user.update({
                where: { id: member.userId },
                data: { isHidden: true, isActive: false }
            })
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

    const isSuperAdmin = currentUser.isSuperAdmin
    
    // Strip hourlyRate if not SUPER_ADMIN
    if (!isSuperAdmin && data.hourlyRate !== undefined) {
        delete data.hourlyRate
    }

    // Strip email if not SUPER_ADMIN
    if (!isSuperAdmin && data.email !== undefined) {
        delete data.email
    }

    try {
        await prisma.$transaction(async (tx) => {
            const student = await tx.student.findUnique({ 
                where: { id: studentId },
                select: { userId: true, email: true }
            })
            if (!student) throw new Error("Student not found")

            // If email changed, update User record too
            if (data.email && data.email !== student.email) {
                const emailInUse = await tx.user.findUnique({ where: { email: data.email } })
                if (emailInUse && emailInUse.id !== student.userId) {
                    throw new Error("Email is already in use by another user")
                }
                
                await tx.user.update({
                    where: { id: student.userId },
                    data: { email: data.email }
                })
            }

            await tx.student.update({
                where: { id: studentId },
                data: data
            })
        })

        revalidatePath(`/office/students/${studentId}`)
        revalidatePath("/office/students")
        revalidatePath("/office/payments")
        return { success: true }
    } catch (error) {
        console.error("Update student error:", error)
        return { error: error instanceof Error ? error.message : "Failed to update student" }
    }
}

export async function updateSupervisor(supervisorId: string, data: any) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    const isSuperAdmin = currentUser.isSuperAdmin
    
    // Strip email if not SUPER_ADMIN
    if (!isSuperAdmin && data.email !== undefined) {
        delete data.email
    }

    try {
        await prisma.$transaction(async (tx) => {
            const supervisor = await tx.supervisor.findUnique({ 
                where: { id: supervisorId },
                select: { userId: true, email: true }
            })
            if (!supervisor) throw new Error("Supervisor not found")

            // If email changed, update User record too
            if (data.email && data.email !== supervisor.email) {
                const emailInUse = await tx.user.findUnique({ where: { email: data.email } })
                if (emailInUse && emailInUse.id !== supervisor.userId) {
                    throw new Error("Email is already in use by another user")
                }
                
                await tx.user.update({
                    where: { id: supervisor.userId },
                    data: { email: data.email }
                })
            }

            await tx.supervisor.update({
                where: { id: supervisorId },
                data: data
            })
        })

        revalidatePath(`/office/supervisors/${supervisorId}`)
        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        console.error("Update supervisor error:", error)
        return { error: error instanceof Error ? error.message : "Failed to update supervisor" }
    }
}

export async function updateOfficeMember(id: string, data: any, isUserId: boolean = false) {
    const currentUser = await getSessionUser()
    if (!currentUser || currentUser.role !== "OFFICE" || currentUser.officeRole !== "SUPER_ADMIN") {
        return { error: "Unauthorized: Only Super Admin can edit office members" }
    }

    try {
        await prisma.$transaction(async (tx) => {
            let userId = isUserId ? id : ""
            if (!isUserId) {
                const member = await tx.officeMember.findUnique({ where: { id } })
                if (!member) throw new Error("Office member not found")
                userId = member.userId
            }

            // Sync email if provided
            if (data.email) {
                const emailInUse = await tx.user.findUnique({ where: { email: data.email } })
                    if (emailInUse && emailInUse.id !== userId) {
                        throw new Error("Email is already in use by another user")
                    }

                await tx.user.update({
                    where: { id: userId },
                    data: { email: data.email }
                })
                // OfficeMember doesn't have an email field, so we delete it before updating the member record
                delete data.email
            }

            if (isUserId) {
                await tx.officeMember.upsert({
                    where: { userId: id },
                    update: data,
                    create: {
                        userId: id,
                        ...data
                    }
                })
            } else {
                await tx.officeMember.update({
                    where: { id: id },
                    data: data
                })
            }
        })

        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        console.error("Update office member error:", error)
        return { error: error instanceof Error ? error.message : "Failed to update office member" }
    }
}

export async function toggleStudentStatus(studentId: string, disable: boolean) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const student = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } })
        if (!student) return { error: "Student not found" }

        await prisma.$transaction(async (tx) => {
            await tx.student.update({
                where: { id: studentId },
                data: { status: disable ? "DISABLED" : "ACTIVE" }
            })
            await tx.user.update({
                where: { id: student.userId },
                data: { isActive: !disable }
            })
        })

        revalidatePath("/office/students")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update student status" }
    }
}

export async function toggleSupervisorStatus(supervisorId: string, disable: boolean) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const supervisor = await prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { userId: true } })
        if (!supervisor) return { error: "Supervisor not found" }

        await prisma.$transaction(async (tx) => {
            await tx.supervisor.update({
                where: { id: supervisorId },
                data: { status: disable ? "DISABLED" : "ACTIVE" }
            })
            await tx.user.update({
                where: { id: supervisor.userId },
                data: { isActive: !disable }
            })
        })

        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update supervisor status" }
    }
}

export async function toggleOfficeMemberStatus(memberId: string, disable: boolean) {
    const currentUser = await getSessionUser()
    if (!currentUser || currentUser.role !== "OFFICE" || currentUser.officeRole !== "SUPER_ADMIN") {
        return { error: "Unauthorized: Only Super Admin can modify office members" }
    }

    try {
        const member = await prisma.officeMember.findUnique({ where: { id: memberId }, select: { userId: true } })
        if (!member) return { error: "Member not found" }

        if (member.userId === currentUser.id) {
            return { error: "Cannot disable your own account" }
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: member.userId },
                data: { isActive: !disable }
            })
        })

        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update office member status" }
    }
}
// (append mode block starts here)

export async function recoverAccount(id: string, type: "student" | "supervisor" | "office") {
    const currentUser = await getSessionUser()
    if (!currentUser || currentUser.email !== "qa-super@abasystem.com") {
        return { error: "Unauthorized. Vault access only." }
    }

    try {
        await prisma.$transaction(async (tx) => {
            if (type === "student") {
                const student = await tx.student.findUnique({ where: { id } })
                if (student) {
                    await tx.student.update({ where: { id }, data: { status: "ACTIVE" } })
                    await tx.user.update({ where: { id: student.userId }, data: { isHidden: false, isActive: true } })
                }
            } else if (type === "supervisor") {
                const supervisor = await tx.supervisor.findUnique({ where: { id } })
                if (supervisor) {
                    await tx.supervisor.update({ where: { id }, data: { status: "ACTIVE" } })
                    await tx.user.update({ where: { id: supervisor.userId }, data: { isHidden: false, isActive: true } })
                }
            } else {
                const member = await tx.officeMember.findUnique({ where: { id } })
                if (member) {
                    await tx.user.update({ where: { id: member.userId }, data: { isHidden: false, isActive: true } })
                }
            }
        })
        revalidatePath("/office/vault")
        revalidatePath("/office/students")
        revalidatePath("/office/supervisors")
        revalidatePath("/office/team")
        return { success: true }
    } catch (error) {
        return { error: "Failed to recover account" }
    }
}
