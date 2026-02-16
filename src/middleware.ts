import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { nextUrl } = req

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
    const isPublicRoute = ["/login", "/register"].includes(nextUrl.pathname)
    const isAuthRoute = ["/login", "/register"].includes(nextUrl.pathname)

    // Bypass middleware for API auth routes, static assets, and images
    if (isApiAuthRoute || nextUrl.pathname.startsWith("/_next") || nextUrl.pathname.includes(".")) {
        return NextResponse.next()
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            // Optimize redirect based on user state
            // @ts-ignore
            const isFirstLogin = req.auth?.user?.isFirstLogin
            // @ts-ignore
            const onboardingCompleted = req.auth?.user?.onboardingCompleted

            if (isFirstLogin) return NextResponse.redirect(new URL("/change-password", nextUrl))
            if (!onboardingCompleted) return NextResponse.redirect(new URL("/onboarding", nextUrl))

            // @ts-ignore
            const role = req.auth?.user?.role?.toLowerCase() || "student"
            return NextResponse.redirect(new URL(`/${role}`, nextUrl))
        }
        return NextResponse.next()
    }

    if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/login", nextUrl))
    }

    // Secured Routes Logic (Logged In Users)
    // @ts-ignore
    const isFirstLogin = req.auth?.user?.isFirstLogin
    // @ts-ignore
    const onboardingCompleted = req.auth?.user?.onboardingCompleted

    // 1. Force Password Change
    if (isFirstLogin) {
        if (nextUrl.pathname !== "/change-password") {
            return NextResponse.redirect(new URL("/change-password", nextUrl))
        }
        return NextResponse.next()
    }

    // Prevent access to Change Password if NOT First Login (optional UX enhancement)
    if (!isFirstLogin && nextUrl.pathname === "/change-password") {
        // Allow access if explicitly needed? Or redirect to dashboard?
        // Requirement says "Rol OFFICE: Puede editar todos sus datos... Roles STUDENT/SUPERVISOR: Solo pueden editar Phone... y Password."
        // So change-password might be accessible later? But this is specifically the forced change.
        // Let's assume the normal change password is in profile settings, not this route.
        // For now, redirect to onboarding or dashboard to prevent confusion.
        if (!onboardingCompleted) {
            return NextResponse.redirect(new URL("/onboarding", nextUrl))
        }
        // @ts-ignore
        const role = req.auth?.user?.role?.toLowerCase() || "student"
        return NextResponse.redirect(new URL(`/${role}`, nextUrl))
    }

    // 2. Force Onboarding
    if (!onboardingCompleted) {
        if (!nextUrl.pathname.startsWith("/onboarding")) {
            return NextResponse.redirect(new URL("/onboarding", nextUrl))
        }
        return NextResponse.next()
    }

    // 3. Prevent access to Onboarding if Completed
    if (onboardingCompleted && nextUrl.pathname.startsWith("/onboarding")) {
        // @ts-ignore
        const role = req.auth?.user?.role?.toLowerCase() || "student"
        return NextResponse.redirect(new URL(`/${role}`, nextUrl))
    }

    return NextResponse.next()
})

// Stop Middleware from running on static files
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
