import { PrismaClient, UserRole, LevelType, SupervisionType, StudentStatus, CredentialType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log("Creating user step-by-step (CamelCase)...")

    const email = 'maria@example.com'
    const passwordHash = await bcrypt.hash('password123', 10)

    // 1. Create User
    console.log("1. Creating User record...")
    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        try {
            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash: passwordHash,
                    role: UserRole.STUDENT,
                }
            })
            console.log("✅ User created:", user.id)
        } catch (e: any) {
            console.error("❌ Failed to create user:", e.message)
            return
        }
    } else {
        console.log("ℹ️ User already exists:", user.id)
    }

    // 2. Create Student Profile
    console.log("2. Creating Student profile...")
    const student = await prisma.student.findUnique({ where: { userId: user.id } })

    if (!student) {
        try {
            const newStudent = await prisma.student.create({
                data: {
                    userId: user.id,
                    fullName: 'Maria Rodriguez',
                    bacbId: '12345678',
                    level: LevelType.BCaBA,
                    supervisionType: SupervisionType.CONCENTRATED,
                    supervisionPercentage: 0.10,
                    hoursPerMonth: 130,
                    hoursToDo: 130, // Required
                    hoursToPay: 0, // Required (init)
                    amountToPay: 0.0, // Required (init)
                    hoursPerMonth: 130,
                    totalMonths: 1, // Required
                    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Required
                    startDate: new Date(),
                    status: StudentStatus.ACTIVE,
                    phone: "555-0123",
                    city: "Miami",
                    state: "FL",
                    school: "FIU",
                    email: "maria.contact@example.com", // Required
                    credential: CredentialType.RBT
                }
            })
            console.log("✅ Student profile created:", newStudent.id)
        } catch (e: any) {
            console.error("❌ Failed to create student profile:", e.message)
        }
    } else {
        console.log("ℹ️ Student profile already exists")
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
    })
