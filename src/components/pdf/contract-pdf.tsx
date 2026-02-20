import React from "react"
import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    Font,
} from "@react-pdf/renderer"
import { format } from "date-fns"

// Register a clean font
Font.register({
    family: "Helvetica",
    fonts: []
})

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: "Helvetica",
        color: "#1a1a1a",
        lineHeight: 1.5,
    },
    // ── Header (clinic info) ──────────────────────────
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: "#2563eb",
        paddingBottom: 12,
    },
    clinicName: {
        fontSize: 18,
        fontFamily: "Helvetica-Bold",
        color: "#1d4ed8",
        marginBottom: 2,
    },
    clinicSub: {
        fontSize: 8,
        color: "#6b7280",
    },
    headerRight: {
        textAlign: "right",
        fontSize: 9,
        color: "#374151",
    },
    // ── Contract Title ────────────────────────────────
    titleBlock: {
        backgroundColor: "#dbeafe",
        borderLeftWidth: 4,
        borderLeftColor: "#2563eb",
        padding: "8 12",
        marginBottom: 14,
    },
    title: {
        fontSize: 13,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginBottom: 3,
    },
    identityLine: {
        fontSize: 9,
        color: "#374151",
    },
    // ── Body text ─────────────────────────────────────
    sectionTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        marginTop: 10,
        marginBottom: 3,
        color: "#1e3a8a",
    },
    bodyText: {
        fontSize: 9,
        color: "#374151",
        marginBottom: 4,
    },
    bulletRow: {
        flexDirection: "row",
        marginBottom: 3,
    },
    bullet: {
        width: 14,
        fontSize: 9,
        color: "#374151",
    },
    bulletText: {
        flex: 1,
        fontSize: 9,
        color: "#374151",
    },
    // ── Signature block ───────────────────────────────
    signatureSection: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: "#d1d5db",
        paddingTop: 12,
    },
    signTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginBottom: 8,
    },
    signCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 4,
        padding: 10,
        marginBottom: 8,
        backgroundColor: "#f9fafb",
    },
    signLeft: {
        flex: 1,
    },
    signName: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        marginBottom: 2,
    },
    signRole: {
        fontSize: 8,
        color: "#6b7280",
    },
    signImageWrapper: {
        width: 120,
        height: 50,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 4,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    signImage: {
        width: 120,
        height: 50,
        objectFit: "contain",
    },
    noSignPlaceholder: {
        fontSize: 7,
        color: "#9ca3af",
        textAlign: "center",
    },
    footer: {
        position: "absolute",
        bottom: 24,
        left: 40,
        right: 40,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7,
        color: "#9ca3af",
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
        paddingTop: 6,
    },
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SigningParty {
    name: string
    role: "TRAINEE" | "BCBA" | "BCaBA"
    bacbId: string
    signatureUrl?: string | null
    isMain?: boolean
}

interface ContractPDFProps {
    trainee: SigningParty
    supervisors: SigningParty[]
    effectiveDate: Date
    clinic: {
        name: string
        address: string
        phone: string
        email: string
        website: string
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ContractPDF({ trainee, supervisors, effectiveDate, clinic }: ContractPDFProps) {
    const primarySupervisor = supervisors.find(s => s.isMain) ?? supervisors[0]
    const formattedDate = format(effectiveDate, "MM/dd/yyyy")

    return (
        <Document
            title="ABA Supervision Contract"
            author={clinic.name}
            creator={clinic.name}
        >
            <Page size="LETTER" style={styles.page}>

                {/* ── HEADER ─────────────────────────────────── */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.clinicName}>{clinic.name}</Text>
                        <Text style={styles.clinicSub}>{clinic.address}</Text>
                        <Text style={styles.clinicSub}>Phone: {clinic.phone}</Text>
                        <Text style={styles.clinicSub}>{clinic.email}  |  {clinic.website}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={{ fontFamily: "Helvetica-Bold" }}>SUPERVISION CONTRACT</Text>
                        <Text>Date: {formattedDate}</Text>
                    </View>
                </View>

                {/* ── TITLE BLOCK ────────────────────────────── */}
                <View style={styles.titleBlock}>
                    <Text style={styles.title}>SUPERVISION CONTRACT</Text>
                    <Text style={styles.identityLine}>
                        Trainee: {trainee.name} BACB # {trainee.bacbId}
                    </Text>
                    {primarySupervisor && (
                        <Text style={styles.identityLine}>
                            Supervisor: {primarySupervisor.name} BCBA # {primarySupervisor.bacbId}
                        </Text>
                    )}
                </View>

                {/* ── TRAINING GOAL ──────────────────────────── */}
                <Text style={styles.sectionTitle}>Training Goal</Text>
                <Text style={styles.bodyText}>
                    The purpose of this supervision agreement is to provide {trainee.name} (hereafter "Trainee")
                    with the opportunity to gain and demonstrate the Knowledge, Skills, and Abilities (KSAs)
                    required for BACB certification. The supervisor named above will provide oversight in
                    compliance with BACB Supervisor Training Curriculum Outline standards.
                </Text>

                {/* ── SUPERVISOR RESPONSIBILITIES ────────────── */}
                <Text style={styles.sectionTitle}>Supervisor Responsibilities</Text>
                {[
                    "Provide a minimum of 5% individual supervision hours per month relative to the total supervised hours.",
                    "Maintain documentation of all supervision sessions in accordance with BACB requirements.",
                    "Review work products and provide timely, corrective feedback.",
                    "Ensure the Trainee adheres to the BACB Professional and Ethical Compliance Code.",
                    "Complete and sign all required monthly BACB experience verification documentation.",
                    "Notify the Trainee of any changes to supervisory arrangements in advance.",
                ].map((text, i) => (
                    <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bulletText}>{text}</Text>
                    </View>
                ))}

                {/* ── TRAINEE RESPONSIBILITIES ───────────────── */}
                <Text style={styles.sectionTitle}>Trainee Responsibilities</Text>
                {[
                    "Maintain accurate records of all supervised and independent fieldwork hours.",
                    "Attend all scheduled supervision sessions and arrive prepared.",
                    "Submit required documentation (timesheets, activity logs) on time.",
                    "Notify the Supervisor of any client-related concerns or ethical dilemmas promptly.",
                    "Adhere to all agency policies and BACB ethical standards.",
                    "Complete required monthly verification forms for supervisor countersignature.",
                ].map((text, i) => (
                    <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bulletText}>{text}</Text>
                    </View>
                ))}

                {/* ── TERMS ──────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Terms & Termination</Text>
                <Text style={styles.bodyText}>
                    This agreement is effective as of {formattedDate} and shall remain in force until
                    terminated by either party with reasonable written notice. Either party may terminate
                    this agreement if BACB or agency requirements are not met. Upon termination, the Supervisor
                    will not countersign any hours accrued after the termination date.
                </Text>

                <Text style={styles.bodyText}>
                    By signing below, both parties confirm they have read, understood, and agree to abide by
                    the terms of this contract. The undersigned agree to sign this contract on {formattedDate}.
                </Text>

                {/* ── SIGNATURE SECTION ──────────────────────── */}
                <View style={styles.signatureSection}>
                    <Text style={styles.signTitle}>Signatures</Text>

                    {/* Trainee */}
                    <View style={styles.signCard}>
                        <View style={styles.signLeft}>
                            <Text style={styles.signName}>{trainee.name}</Text>
                            <Text style={styles.signRole}>Trainee — BACB # {trainee.bacbId}</Text>
                        </View>
                        <View style={styles.signImageWrapper}>
                            {trainee.signatureUrl ? (
                                <Image src={trainee.signatureUrl} style={styles.signImage} />
                            ) : (
                                <Text style={styles.noSignPlaceholder}>Signature pending</Text>
                            )}
                        </View>
                    </View>

                    {/* Each assigned supervisor */}
                    {supervisors.map((sup, idx) => (
                        <View key={idx} style={styles.signCard}>
                            <View style={styles.signLeft}>
                                <Text style={styles.signName}>
                                    {sup.name}{sup.isMain ? " (Primary)" : ""}
                                </Text>
                                <Text style={styles.signRole}>
                                    {sup.role} — BACB # {sup.bacbId}
                                </Text>
                            </View>
                            <View style={styles.signImageWrapper}>
                                {sup.signatureUrl ? (
                                    <Image src={sup.signatureUrl} style={styles.signImage} />
                                ) : (
                                    <Text style={styles.noSignPlaceholder}>Signature pending</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>

                {/* ── FOOTER ─────────────────────────────────── */}
                <View style={styles.footer} fixed>
                    <Text>{clinic.name} — Confidential Document</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}
