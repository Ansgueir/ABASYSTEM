"use client"

import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { useTransition } from "react"
import { recoverAccount } from "@/actions/users"
import { toast } from "sonner"

export function RecoverActionBtn({ id, type, name }: { id: string, type: "student" | "supervisor" | "office", name: string }) {
    const [isPending, startTransition] = useTransition()

    const handleRecover = () => {
        startTransition(async () => {
            const result = await recoverAccount(id, type)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`${name} recovered successfully!`)
            }
        })
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleRecover}
            disabled={isPending}
            className="hover:bg-green-100 hover:text-green-700 hover:border-green-300 transition-colors"
        >
            <RotateCcw className="h-4 w-4 mr-2" />
            {isPending ? "Recovering..." : "Recover"}
        </Button>
    )
}
