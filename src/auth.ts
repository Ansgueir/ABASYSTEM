import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
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
                })

                if (!user || !user.passwordHash) {
                    return null
                }

                const passwordsMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )

                if (passwordsMatch) {
                    return {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                    }
                }

                return null
            },
        }),
    ],
    callbacks: {
        jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id
                // @ts-ignore
                token.role = user.role
            }
            return token
        },
        session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.id as string
                // @ts-ignore
                (session.user as any).role = token.role as string
            }
            return session
        },
    },
})
