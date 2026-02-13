"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Loader2 } from "lucide-react"
import { generateContractAction } from "@/actions/contracts"
import { useRouter } from "next/navigation"

export function GenerateContractButton({ studentId }: { studentId: string }) {
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    async function handleGenerate() {
        setIsPending(true)
        const result = await generateContractAction(studentId)
        setIsPending(false)

        if (result.success) {
            alert("Contract generated successfully!")
            router.refresh()
        } else {
            alert("Error: " + result.error)
        }
    }

    return (
        <Button onClick={handleGenerate} disabled={isPending} variant="outline" className="w-full justify-start">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Generate Contract
        </Button>
    )
}
