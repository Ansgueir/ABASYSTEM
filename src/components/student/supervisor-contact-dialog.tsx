"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mail, Phone, MapPin, Building, ShieldCheck, GraduationCap } from "lucide-react"

interface SupervisorContactDialogProps {
    supervisor: any
}

export function SupervisorContactDialog({ supervisor }: SupervisorContactDialogProps) {
    if (!supervisor) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                    Contact
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Supervisor Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Header Info */}
                    <div className="flex items-center gap-4 border-b pb-4">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl border-2 border-primary/20">
                            {supervisor.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{supervisor.fullName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                                    {supervisor.credentialType || 'BCBA'}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> BACB: {supervisor.bacbId}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Contact Elements */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium">Email Address</p>
                                <a href={`mailto:${supervisor.email}`} className="text-sm text-primary hover:underline truncate block">
                                    {supervisor.email}
                                </a>
                            </div>
                            <Button size="sm" variant="secondary" className="shrink-0" asChild>
                                <a href={`mailto:${supervisor.email}`}>Email</a>
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">Phone Number</p>
                                <a href={`tel:${supervisor.phone}`} className="text-sm text-primary hover:underline">
                                    {supervisor.phone || 'Not Provided'}
                                </a>
                            </div>
                            {supervisor.phone && (
                                <Button size="sm" variant="secondary" className="shrink-0" asChild>
                                    <a href={`tel:${supervisor.phone}`}>Call</a>
                                </Button>
                            )}
                        </div>

                        {supervisor.companyName && (
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <Building className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Company</p>
                                    <p className="text-sm text-muted-foreground">{supervisor.companyName}</p>
                                </div>
                            </div>
                        )}

                        {supervisor.address && (
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Location</p>
                                    <p className="text-sm text-muted-foreground">{supervisor.address}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
