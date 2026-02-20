"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, CheckCircle, ShieldCheck } from "lucide-react"
import { approveContract } from "@/actions/contracts"
import { toast } from "sonner"

interface ApproveDialogProps {
    contractId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ApproveContractDialog({ contractId, open, onOpenChange }: ApproveDialogProps) {
    const [pending, startTransition] = useTransition()

    function handleSubmit() {
        startTransition(async () => {
            const result = await approveContract(contractId)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Contract signed successfully")
                onOpenChange(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <DialogTitle className="text-center text-xl">Approve & Sign</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        By approving this document, you are providing a <strong>binding digital signature</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted/50 p-4 rounded-lg my-4 border border-dashed border-muted-foreground/30">
                    <div className="flex items-center gap-3 text-sm text-foreground/80">
                        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                        <p>Your signature currently on file will be applied to the final PDF contract.</p>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                    Please ensure you have reviewed the contract PDF before proceeding.
                </p>

                <DialogFooter className="mt-6 flex sm:justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={pending}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={pending}
                        className="flex-1 bg-success hover:bg-success/90 text-white"
                    >
                        {pending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Sign & Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
