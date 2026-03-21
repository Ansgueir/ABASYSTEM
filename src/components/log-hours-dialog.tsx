"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Clock, Loader2, Repeat, CheckCircle2, Zap } from "lucide-react"
import { format, eachDayOfInterval, addDays } from "date-fns"

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
import { logHours, logBulkHours } from "@/actions/log-hours"
import { toast } from "sonner"

const SettingTypeOptions = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"] as const
const ActivityTypeOptions = ["RESTRICTED", "UNRESTRICTED"] as const

const WEEKDAYS = [
    { label: "S", fullLabel: "Sunday", value: 0 },
    { label: "M", fullLabel: "Monday", value: 1 },
    { label: "T", fullLabel: "Tuesday", value: 2 },
    { label: "W", fullLabel: "Wednesday", value: 3 },
    { label: "T", fullLabel: "Thursday", value: 4 },
    { label: "F", fullLabel: "Friday", value: 5 },
    { label: "S", fullLabel: "Saturday", value: 6 },
]

const formSchema = z.object({
    type: z.enum(["independent", "supervision"]),
    mode: z.enum(["single", "bulk"]),
    // Single mode
    date: z.date().optional(),
    // Bulk mode
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    weekdays: z.array(z.number()).optional(),
    // Shared
    startTime: z.string().min(1, "Start time is required"),
    minutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
    setting: z.enum(SettingTypeOptions),
    activityType: z.enum(ActivityTypeOptions),
    notes: z.string().optional(),
})

interface LogHoursDialogProps {
    disabled?: boolean
    disabledMessage?: string
}

export function LogHoursDialog({ disabled = false, disabledMessage }: LogHoursDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [errorDialogOpen, setErrorDialogOpen] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            type: "independent",
            mode: "single",
            date: new Date(),
            startDate: new Date(),
            endDate: addDays(new Date(), 7),
            weekdays: [1, 2, 3, 4, 5], // Mon-Fri default
            startTime: "09:00",
            minutes: 60,
            setting: "CLIENTS_HOME",
            activityType: "UNRESTRICTED",
            notes: ""
        },
    })

    const watchMode = form.watch("mode")
    const watchStartDate = form.watch("startDate")
    const watchEndDate = form.watch("endDate")
    const watchWeekdays = form.watch("weekdays") || []
    const watchMinutes = form.watch("minutes")

    // Preview: count matching days
    const previewCount = useMemo(() => {
        if (watchMode !== "bulk" || !watchStartDate || !watchEndDate || watchWeekdays.length === 0) return 0
        if (watchStartDate > watchEndDate) return 0
        const days = eachDayOfInterval({ start: watchStartDate, end: watchEndDate })
        return days.filter(d => watchWeekdays.includes(d.getDay())).length
    }, [watchMode, watchStartDate, watchEndDate, watchWeekdays])

    const previewTotalHours = ((watchMinutes || 0) / 60 * previewCount).toFixed(1)

    const toggleWeekday = (dayValue: number) => {
        const current = form.getValues("weekdays") || []
        const updated = current.includes(dayValue)
            ? current.filter(d => d !== dayValue)
            : [...current, dayValue]
        form.setValue("weekdays", updated)
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsPending(true)

        try {
            if (values.mode === "single") {
                // Single log
                const formData = new FormData()
                formData.append("type", values.type)
                formData.append("date", values.date!.toISOString())
                formData.append("startTime", values.startTime)
                formData.append("minutes", values.minutes.toString())
                formData.append("setting", values.setting)
                formData.append("activityType", values.activityType)
                if (values.notes) formData.append("notes", values.notes)

                const result = await (logHours as any)(null, formData) as Awaited<ReturnType<typeof logHours>>
                setIsPending(false)

                if (result.warning) {
                    setTimeout(() => {
                        toast.warning(result.warning!, { duration: 8000 })
                    }, 300)
                }

                if (result.success) {
                    setOpen(false)
                    form.reset()
                    toast.success("✅ Hour logged successfully!")
                } else {
                    setErrorMessage(result.error || "An unknown error occurred.")
                    setErrorDialogOpen(true)
                }
            } else {
                // Bulk log
                if (!values.startDate || !values.endDate || !values.weekdays || values.weekdays.length === 0) {
                    setErrorMessage("Please select a date range and at least one weekday.")
                    setErrorDialogOpen(true)
                    setIsPending(false)
                    return
                }

                const result = await logBulkHours({
                    type: values.type,
                    startDate: values.startDate.toISOString(),
                    endDate: values.endDate.toISOString(),
                    weekdays: values.weekdays,
                    startTime: values.startTime,
                    minutes: values.minutes,
                    setting: values.setting,
                    activityType: values.activityType,
                    notes: values.notes,
                })

                setIsPending(false)

                if (result.success) {
                    setOpen(false)
                    form.reset()
                    toast.success(`✅ Bulk schedule created: ${result.created} logs added${result.skipped ? `, ${result.skipped} skipped` : ''}.`, {
                        duration: 6000
                    })
                } else {
                    setErrorMessage(result.error || "An unknown error occurred.")
                    setErrorDialogOpen(true)
                }
            }
        } catch (error) {
            setIsPending(false)
            setErrorMessage(error instanceof Error ? error.message : "Unknown error")
            setErrorDialogOpen(true)
        }
    }

    return (
        <>
            {disabled ? (
                <Button
                    className="bg-indigo-600/50 hover:bg-indigo-600/60 text-white cursor-not-allowed"
                    onClick={() => {
                        setErrorMessage(disabledMessage || "You cannot log hours yet. Please contact the Office.")
                        setErrorDialogOpen(true)
                    }}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    Log Hours
                </Button>
            ) : (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Clock className="mr-2 h-4 w-4" />
                            Log Hours
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-indigo-500" />
                                Log Hours
                            </DialogTitle>
                            <DialogDescription>
                                Log a single session or schedule a recurring block.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("Form Errors:", errors))} className="space-y-4">

                                {/* Mode Toggle */}
                                <FormField
                                    control={form.control}
                                    name="mode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange("single")}
                                                    className={cn(
                                                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                                                        field.value === "single"
                                                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-600"
                                                            : "border-border text-muted-foreground hover:border-indigo-300"
                                                    )}
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    Single Session
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange("bulk")}
                                                    className={cn(
                                                        "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                                                        field.value === "bulk"
                                                            ? "border-violet-500 bg-violet-500/10 text-violet-600"
                                                            : "border-border text-muted-foreground hover:border-violet-300"
                                                    )}
                                                >
                                                    <Repeat className="h-4 w-4" />
                                                    Recurring Schedule
                                                </button>
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                {/* Type */}
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

                                {/* SINGLE MODE: Single date */}
                                {watchMode === "single" && (
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
                                                                    variant="outline"
                                                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                                                >
                                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
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
                                )}

                                {/* BULK MODE: Date range + weekday selector */}
                                {watchMode === "bulk" && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Start Date */}
                                            <FormField
                                                control={form.control}
                                                name="startDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Start Date</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button variant="outline" className={cn("pl-3 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                                                                        {field.value ? format(field.value, "PP") : <span>Pick start</span>}
                                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {/* End Date */}
                                            <FormField
                                                control={form.control}
                                                name="endDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>End Date</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button variant="outline" className={cn("pl-3 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                                                                        {field.value ? format(field.value, "PP") : <span>Pick end</span>}
                                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Start Time (bulk) */}
                                        <FormField
                                            control={form.control}
                                            name="startTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Start Time (each session)</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Weekday selector */}
                                        <div>
                                            <p className="text-sm font-medium mb-2">Repeat on Days</p>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {WEEKDAYS.map((day) => (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        title={day.fullLabel}
                                                        onClick={() => toggleWeekday(day.value)}
                                                        className={cn(
                                                            "h-9 w-9 rounded-full text-xs font-bold transition-all border-2",
                                                            watchWeekdays.includes(day.value)
                                                                ? "bg-violet-500 border-violet-500 text-white shadow-md"
                                                                : "border-border text-muted-foreground hover:border-violet-300"
                                                        )}
                                                    >
                                                        {day.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Preview card */}
                                        {previewCount > 0 && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                                <Zap className="h-4 w-4 text-violet-500 shrink-0" />
                                                <p className="text-sm text-violet-700 dark:text-violet-300 font-medium">
                                                    Will generate <span className="font-bold">{previewCount} logs</span> totaling <span className="font-bold">{previewTotalHours}h</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Duration */}
                                <FormField
                                    control={form.control}
                                    name="minutes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duration per Session (Minutes)</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center space-x-2">
                                                    <Input type="number" {...field} />
                                                    <span className="text-sm text-muted-foreground shrink-0">min = {((field.value || 0) / 60).toFixed(2)}h</span>
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
                                                            <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
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
                                    <Button
                                        type="submit"
                                        disabled={isPending}
                                        className={watchMode === "bulk"
                                            ? "bg-violet-600 hover:bg-violet-700 text-white"
                                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                        }
                                    >
                                        {isPending ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                                        ) : watchMode === "bulk" ? (
                                            <><CheckCircle2 className="mr-2 h-4 w-4" />Generate {previewCount > 0 ? `${previewCount} Logs` : 'Schedule'}</>
                                        ) : "Save Log"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Error Dialog */}
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
