"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Clock, Loader2 } from "lucide-react"
import { format } from "date-fns"

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
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { logHours } from "@/actions/log-hours"
import { toast } from "sonner" // Assuming sonner or use toast hook. Using alert for now if no toast.

// Replicating enums for client-side to avoid server imports issues
const SettingTypeOptions = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"] as const
const ActivityTypeOptions = ["RESTRICTED", "UNRESTRICTED"] as const

const formSchema = z.object({
    type: z.enum(["independent", "supervision"]),
    date: z.date(),
    startTime: z.string().min(1, "Start time is required"),
    minutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
    setting: z.enum(SettingTypeOptions),
    activityType: z.enum(ActivityTypeOptions),
    notes: z.string().optional(),
})

export function LogHoursDialog() {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            type: "independent",
            date: new Date(),
            startTime: "09:00",
            minutes: 60,
            setting: "CLIENTS_HOME",
            activityType: "UNRESTRICTED",
            notes: ""
        },
    })

    const [errorDialogOpen, setErrorDialogOpen] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    async function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Submitting form with values:", values)
        setIsPending(true)
        try {
            const formData = new FormData()
            formData.append("type", values.type)
            formData.append("date", values.date.toISOString())
            formData.append("startTime", values.startTime)
            formData.append("minutes", values.minutes.toString())
            formData.append("setting", values.setting)
            formData.append("activityType", values.activityType)
            if (values.notes) formData.append("notes", values.notes)

            console.log("Calling server action logHours...")
            // @ts-ignore
            const result = await logHours(null, formData)
            console.log("Server action result:", result)

            setIsPending(false)

            if (result.warning) {
                console.warn("Warning from server:", result.warning)
                // Short delay to ensure it appears on top of success toast
                setTimeout(() => {
                    toast.warning(result.warning, {
                        duration: 8000,
                        action: {
                            label: "Dismiss",
                            onClick: () => console.log("Warning dismissed")
                        }
                    })
                }, 500)
            }

            if (result.success) {
                console.log("Success!")
                setOpen(false)
                form.reset()
                toast.success("✅ Hours logged successfully!")
            } else {
                console.error("Error from server:", result.error)
                // Show centralized persistent error dialog
                setErrorMessage(result.error || "An unknown error occurred.")
                setErrorDialogOpen(true)
            }
        } catch (error) {
            console.error("Client side error during submission:", error)
            setIsPending(false)
            setErrorMessage(error instanceof Error ? error.message : "Unknown error")
            setErrorDialogOpen(true)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Clock className="mr-2 h-4 w-4" />
                        Log Hours
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Log Hours</DialogTitle>
                        <DialogDescription>
                            Record your fieldwork hours.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("Form Errors:", errors))} className="space-y-4">

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="independent">Independent</SelectItem>
                                                <SelectItem value="supervision">Supervised</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Date of Service</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date > new Date() || date < new Date("1900-01-01")
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="startTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Start Time</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="minutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Duration (Minutes)</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center space-x-2">
                                                <Input type="number" {...field} />
                                                <span className="text-sm text-muted-foreground">min</span>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="setting"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Setting</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select setting" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {SettingTypeOptions.map(s => (
                                                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="activityType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Activity</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select activity" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ActivityTypeOptions.map(a => (
                                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description / Notes</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Short description of activities..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isPending} variant="gradient">
                                    {isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Log"
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <DialogContent className="sm:max-w-[425px] border-l-4 border-red-600">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 text-xl">
                            <span className="text-2xl">❌</span> Error
                        </DialogTitle>
                        <DialogDescription className="pt-4 text-base text-gray-900 font-medium">
                            {errorMessage}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button
                            onClick={() => setErrorDialogOpen(false)}
                            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                        >
                            Understood / Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
