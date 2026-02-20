"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Clock, Loader2, User } from "lucide-react"
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
import { toast } from "sonner"

const SettingTypeOptions = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"] as const
const ActivityTypeOptions = ["RESTRICTED", "UNRESTRICTED"] as const
const SupervisionFormatOptions = ["INDIVIDUAL", "GROUP"] as const

const formSchema = z.object({
    studentId: z.string().min(1, "Student is required"),
    date: z.date(),
    startTime: z.string().min(1, "Start time is required"),
    minutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
    setting: z.enum(SettingTypeOptions),
    activityType: z.enum(ActivityTypeOptions),
    supervisionFormat: z.enum(SupervisionFormatOptions),
    notes: z.string().optional(),
})

interface LogSupervisionDialogProps {
    students: { id: string, fullName: string }[]
}

export function LogSupervisionDialog({ students }: LogSupervisionDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            date: new Date(),
            startTime: "09:00",
            minutes: 60,
            setting: "CLIENTS_HOME",
            activityType: "UNRESTRICTED",
            supervisionFormat: "INDIVIDUAL",
            notes: ""
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsPending(true)
        const formData = new FormData()
        formData.append("type", "supervision") // Force supervision type
        formData.append("studentId", values.studentId)
        formData.append("date", values.date.toISOString())
        formData.append("startTime", values.startTime)
        formData.append("minutes", values.minutes.toString())
        formData.append("setting", values.setting)
        formData.append("activityType", values.activityType)
        formData.append("supervisionFormat", values.supervisionFormat)
        if (values.notes) formData.append("notes", values.notes)

        // @ts-ignore
        const result = await logHours(null, formData)

        setIsPending(false)

        if (result.success) {
            setOpen(false)
            form.reset()
            toast.success("Supervision hours logged successfully!")
        } else {
            toast.error(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="gradient">
                    <Clock className="mr-2 h-4 w-4" />
                    Log Supervision
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Log Supervision Hours</DialogTitle>
                    <DialogDescription>
                        Record supervision hours provided to a student.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.log(errors))} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="studentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Student</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select student" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {students.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                                            ))}
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
                                        <FormLabel>Date</FormLabel>
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="minutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Duration (Min)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supervisionFormat"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Format</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select format" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {SupervisionFormatOptions.map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Session notes..." {...field} />
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
    )
}
