import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                if (!credentials?.email || !credentials?.password) return null

                const email = credentials.email as string
                const user = await prisma.user.findUnique({
                    where: { email },
                    include: {
                        student: true,
                        supervisor: true,
                        officeMember: true
                    }
                })

                if (!user || !user.passwordHash) {
                    return null
                }

                const passwordsMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )

                if (passwordsMatch) {
                    if (user.isActive === false) return null

                    // Determine full name based on role/relation
                    let name = "User"
                    let officeRole = null

                    if (user.student) name = user.student.fullName
                    else if (user.supervisor) name = user.supervisor.fullName
                    else if (user.officeMember) {
                        name = user.officeMember.fullName
                        officeRole = user.officeMember.officeRole
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: name,
                        role: user.role,
                        officeRole: officeRole,
                        isFirstLogin: user.isFirstLogin,
                        onboardingCompleted: user.onboardingCompleted,
                        onboardingStep: user.onboardingStep
                    }
                }

                return null
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id
                token.name = user.name
                // @ts-ignore
                token.role = user.role
                // @ts-ignore
                token.officeRole = user.officeRole
                // @ts-ignore
                token.isFirstLogin = user.isFirstLogin
                // @ts-ignore
                token.onboardingCompleted = user.onboardingCompleted
                // @ts-ignore
                token.onboardingStep = user.onboardingStep
            }

            // Continuous session validation: Check if user is still active
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { isActive: true, role: true, officeMember: { select: { officeRole: true, fullName: true } } }
                    })

                    console.log(`[AUTH] Checking user ${token.id}:`, dbUser ? "Found" : "Not Found", dbUser?.isActive);

                    // If user doesn't exist or is disabled, invalidate token
                    if (!dbUser || dbUser.isActive === false) {
                        console.log(`[AUTH] Invalidating session for ${token.id} - User inactive or missing`);
                        return null // This invalidates the session
                    }

                    // Optional: Update role if changed in DB (good for hierarchy changes)
                    // @ts-ignore
                    if (dbUser.role) token.role = dbUser.role
                    if (dbUser.officeMember?.officeRole) {
                        // @ts-ignore
                        token.officeRole = dbUser.officeMember.officeRole
                    }
                } catch (error) {
                    console.error("[AUTH] Error validating session:", error);
                    // Decide whether to fail safe or block. 
                    // If DB is down, maybe we shouldn't kill the session? 
                    // But for security, usually we fail closed.
                    // For debugging now, let's log and NOT return null to see if it allows login.
                }
            }

            // Allow updating session data via update()
            if (trigger === "update" && session) {
                if (session.name) token.name = session.name
                if (session.isFirstLogin !== undefined) token.isFirstLogin = session.isFirstLogin
                if (session.onboardingCompleted !== undefined) token.onboardingCompleted = session.onboardingCompleted
                if (session.onboardingStep !== undefined) token.onboardingStep = session.onboardingStep
            }

            return token
        },
        session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.id as string
                session.user.name = token.name as string
                // @ts-ignore
                (session.user as any).role = token.role as string
                // @ts-ignore
                (session.user as any).officeRole = token.officeRole as string
                // @ts-ignore
                (session.user as any).isFirstLogin = token.isFirstLogin as boolean
                // @ts-ignore
                (session.user as any).onboardingCompleted = token.onboardingCompleted as boolean
                // @ts-ignore
                (session.user as any).onboardingStep = token.onboardingStep as number
            }
            return session
        },
    },
})
