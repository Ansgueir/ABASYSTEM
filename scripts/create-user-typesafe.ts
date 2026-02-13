import { PrismaClient, UserRole, LevelType, SupervisionType, StudentStatus, CredentialType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log("Creating user step-by-step (Typesafe)...")

    const email = 'maria@example.com'
    const passwordHash = await bcrypt.hash('password123', 10)
    console.log("Hash generated:", passwordHash)

    // 1. Create User
    console.log("1. Creating User record...")
    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        try {
            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash: passwordHash,
                    role: UserRole.student, // Use Enum
                }
            })
            console.log("✅ User created:", user.id)
        } catch (e: any) {
            console.error("❌ Failed to create user:")
            console.error(e.message) // Print message clearly
            return
        }
    } else {
        console.log("ℹ️ User already exists:", user.id)
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: passwordHash }
        })
        console.log("ℹ️ Updated password")
    }

    // 2. Create Student Profile
    console.log("2. Creating Student profile...")
    const student = await prisma.student.findUnique({ where: { user_id: user.id } })

    if (!student) {
        try {
            const newStudent = await prisma.student.create({
                data: {
                    user_id: user.id,
                    full_name: 'Maria Rodriguez',
                    bacb_id: '12345678',
                    level: LevelType.BCaBA, // Use Enum
                    supervision_type: SupervisionType.concentrated, // Use Enum
                    supervision_percentage: 0.10,
                    hours_per_month: 130,
                    start_date: new Date(),
                    status: StudentStatus.active, // Use Enum
                    phone: "555-0123",
                    city: "Miami",
                    state: "FL",
                    school: "FIU",
                    credential: CredentialType.RBT // Use Enum
                }
            })
            console.log("✅ Student profile created:", newStudent.id)
        } catch (e: any) {
            console.error("❌ Failed to create student profile:")
            console.error(e.message)
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
