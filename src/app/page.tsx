import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()

  if (session?.user) {
    const role = String((session.user as any).role).toLowerCase()
    if (role === "student") {
      redirect("/student")
    } else if (role === "supervisor") {
      redirect("/supervisor")
    } else if (role === "office" || role === "qa") {
      redirect("/office")
    } else {
      redirect("/student") // Default fallback
    }
  } else {
    redirect("/login")
  }
}
