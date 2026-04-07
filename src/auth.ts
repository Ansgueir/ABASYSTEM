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
                console.log("[AUTH-DEBUG] Authorize called with email:", credentials?.email);
                if (!credentials?.email || !credentials?.password) {
                    console.log("[AUTH-DEBUG] Missing email or password");
                    return null;
                }

                const email = credentials.email as string
                const user = await prisma.user.findUnique({
                    where: { email },
                    include: {
                        student: true,
                        supervisor: true,
                        officeMember: true
                    }
                })

                if (!user) {
                    console.log("[AUTH-DEBUG] User not found in DB");
                    return null
                }
                if (!user.passwordHash) {
                    console.log("[AUTH-DEBUG] User has no passwordHash");
                    return null
                }

                console.log("[AUTH-DEBUG] Comparing passwords...");
                const passwordsMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )
                console.log("[AUTH-DEBUG] bcrypt result:", passwordsMatch);

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

                    console.log("[AUTH-DEBUG] Successfully returning user payload");
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

                console.log("[AUTH-DEBUG] Passwords did not match");
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

            // 1. Priority: Allow updating session data via update()
            if (trigger === "update" && session) {
                if (session.name) token.name = session.name
                if (session.isFirstLogin !== undefined) token.isFirstLogin = session.isFirstLogin
                if (session.onboardingCompleted !== undefined) token.onboardingCompleted = session.onboardingCompleted
                if (session.onboardingStep !== undefined) token.onboardingStep = session.onboardingStep
                return token // Return immediately after manual update
            }

            // 2. Continuous session validation: Sync with DB (ONLY in Node.js runtime)
            // Middleware (Edge) must rely on the JWT to avoid Prisma crashes
            if (token.id && process.env.NEXT_RUNTIME === "nodejs") {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { 
                            isActive: true, 
                            role: true, 
                            isFirstLogin: true, 
                            onboardingCompleted: true,
                            onboardingStep: true,
                            officeMember: { select: { officeRole: true} } 
                        }
                    })

                    // If user doesn't exist or is disabled, invalidate token
                    if (!dbUser || dbUser.isActive === false) return null

                    // Sync token flags from fresh DB state
                    token.role = dbUser.role
                    token.isFirstLogin = dbUser.isFirstLogin
                    token.onboardingCompleted = dbUser.onboardingCompleted
                    token.onboardingStep = dbUser.onboardingStep

                    if (dbUser.officeMember?.officeRole) {
                        // @ts-ignore
                        token.officeRole = dbUser.officeMember.officeRole
                    }
                } catch (error) {
                    console.error("[AUTH] JWT Sync Error:", error);
                }
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
    events: {
        async signIn({ user }) {
            try {
                if (!user.id) return;
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        userEmail: user.email || null,
                        action: "LOGIN",
                        entity: "System",
                        entityId: user.id,
                        details: `Successful login`
                    }
                })
            } catch (error) {
                console.error("Failed to log login event:", error)
            }
        }
    }
})
