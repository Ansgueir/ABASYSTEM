
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testAuthorize() {
    console.log("Starting authorize test...");
    const credentials = {
        email: 'testsuperoffice@abasystem.com',
        password: '1Qa2ws3ed.2026'
    }

    if (!credentials?.email || !credentials?.password) {
        console.log("Failed: missing credentials fields");
        return null;
    }

    const email = credentials.email as string
    console.log(`Looking up user: ${email}`);
    
    let user;
    try {
        user = await prisma.user.findUnique({
            where: { email },
            include: {
                student: true,
                supervisor: true,
                officeMember: true
            }
        });
        console.log("DB returned:", user ? `User ID ${user.id}` : "null");
    } catch (e) {
        console.error("Prisma error:", e);
        return null;
    }

    if (!user || !user.passwordHash) {
         console.log("Failed: user is null or passwordHash is missing.");
         return null;
    }

    let passwordsMatch = false;
    try {
         passwordsMatch = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
        );
        console.log("Password match result:", passwordsMatch);
    } catch(e) {
         console.error("Bcrypt error:", e);
         return null;
    }

    if (passwordsMatch) {
         if (user.isActive === false) {
             console.log("Failed: user is inactive");
             return null;
         }

         let name = "User"
         let officeRole = null

         if (user.student) name = user.student.fullName
         else if (user.supervisor) name = user.supervisor.fullName
         else if (user.officeMember) {
             name = user.officeMember.fullName
             officeRole = user.officeMember.officeRole
         }
         
         console.log("Success! Returning token payload:", {
             id: user.id,
             email: user.email,
             name: name,
             role: user.role,
             officeRole: officeRole,
             isFirstLogin: user.isFirstLogin,
             onboardingCompleted: user.onboardingCompleted,
             onboardingStep: user.onboardingStep
         })
         return true;
    }

    console.log("Failed: password did not match.");
    return null
}

testAuthorize()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e)
        prisma.$disconnect()
        process.exit(1)
    })
