"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Upload, File as FileIcon } from "lucide-react"
import { DocumentType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { uploadDocument } from "@/actions/documents"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const DocumentTypeOptions = Object.keys(DocumentType) as [string, ...string[]]

const formSchema = z.object({
    documentType: z.nativeEnum(DocumentType),
    // File validation is handled manually or via custom check
})

interface UploadDocumentDialogProps {
    defaultType?: DocumentType
    targetStudentId?: string
}

export function UploadDocumentDialog({ defaultType, targetStudentId }: UploadDocumentDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            documentType: defaultType || DocumentType.OTHER
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!file) {
            toast.error("Please select a file")
            return
        }

        setIsPending(true)
        const formData = new FormData()
        formData.append("documentType", values.documentType)
        formData.append("file", file)
        if (targetStudentId) {
            formData.append("targetStudentId", targetStudentId)
        }

        // @ts-ignore
        const result = await uploadDocument(null, formData)

        setIsPending(false)

        if (result.success) {
            setOpen(false)
            form.reset()
            setFile(null)
            toast.success("Document uploaded successfully")
            router.refresh()
        } else {
            toast.error(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>
                        Select the document type and file to upload.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="documentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Document Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {DocumentTypeOptions.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type.replace(/_/g, " ")}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormItem>
                            <FormLabel>File (PDF or Image, max 5MB)</FormLabel>
                            <FormControl>
                                <Input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) setFile(f)
                                    }}
                                />
                            </FormControl>
                            {file && (
                                <p className="text-sm text-muted-foreground flex items-center mt-1">
                                    <FileIcon className="h-3 w-3 mr-1" />
                                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                            )}
                        </FormItem>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending || !file} variant="gradient">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    "Upload"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
