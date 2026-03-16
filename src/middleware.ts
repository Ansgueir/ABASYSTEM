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

    // Protected routes handling
    // @ts-ignore
    const isFirstLogin = req.auth?.user?.isFirstLogin
    // @ts-ignore
    const onboardingCompleted = req.auth?.user?.onboardingCompleted
    // @ts-ignore
    const role = req.auth?.user?.role?.toLowerCase() || "student"

    // 1. Force Password Change (highest priority)
    if (isFirstLogin) {
        if (nextUrl.pathname !== "/change-password" && !isPublicRoute) {
            return NextResponse.redirect(new URL("/change-password", nextUrl))
        }
        return NextResponse.next()
    }

    // 2. Force Onboarding
    if (!onboardingCompleted) {
        // Allow access to onboarding paths only
        if (!nextUrl.pathname.startsWith("/onboarding") && !isPublicRoute && nextUrl.pathname !== "/change-password") {
            return NextResponse.redirect(new URL("/onboarding", nextUrl))
        }
        return NextResponse.next()
    }

    // 3. Prevent access to Onboarding/ChangePassword if finished
    if (onboardingCompleted) {
        if (nextUrl.pathname.startsWith("/onboarding") || nextUrl.pathname === "/change-password") {
            return NextResponse.redirect(new URL(`/${role}`, nextUrl))
        }
    }

    return NextResponse.next()
})

// Stop Middleware from running on static files
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
