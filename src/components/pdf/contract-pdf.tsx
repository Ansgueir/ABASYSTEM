import React from "react"
import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    Svg,
    Path,
    Rect,
    G,
} from "@react-pdf/renderer"
import { format } from "date-fns"

// ─── ABA PLC Logo as inline SVG path data ───────────────────────────────────
// A clean professional mark: gradient blue diamond + text
const LogoMark = () => (
    <Svg width="140" height="48" viewBox="0 0 280 96">
        {/* Background rectangle */}
        <Rect x="0" y="0" width="280" height="96" fill="white" />
        {/* Blue diamond / shield mark */}
        <G>
            <Rect x="4" y="10" width="52" height="52" fill="#1e3a8a" rx="6" />
            <Rect x="12" y="18" width="36" height="36" fill="#2563eb" rx="4" />
            <Path d="M30 25 L42 38 L30 51 L18 38 Z" fill="white" />
        </G>
        {/* ABA text */}
        <Path
            d="M68 22 L73 38 L78 22 L83 22 L76 42 L70 42 L63 22 Z"
            fill="#1e3a8a"
        />
        <Path
            d="M86 22 L91 38 L96 22 L101 22 L94 42 L88 42 L81 22 Z"
            fill="#1e3a8a"
        />
        {/* PLC text */}
        <Path d="M106 22 L111 22 L111 36 L120 36 L120 42 L106 42 Z" fill="#2563eb" />
        <Path d="M124 22 L129 22 L129 42 L124 42 Z" fill="#2563eb" />
        <Path d="M134 22 L145 22 L145 27 L139 27 L139 36 L145 36 L145 42 L134 42 Z" fill="#2563eb" />
        {/* Subtitle */}
        <Rect x="62" y="50" width="210" height="1.5" fill="#93c5fd" />
        <Path
            d="M62 58 L272 58"
            stroke="#93c5fd"
            strokeWidth="0.5"
        />
    </Svg>
)

const styles = StyleSheet.create({
    page: {
        paddingTop: 36,
        paddingBottom: 56,
        paddingHorizontal: 45,
        fontSize: 9.5,
        fontFamily: "Helvetica",
        color: "#1a1a1a",
        lineHeight: 1.55,
    },
    // ── Header ─────────────────────────────────────────
    headerWrap: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
        borderBottomWidth: 2.5,
        borderBottomColor: "#1e3a8a",
        paddingBottom: 10,
    },
    logoArea: {
        flexDirection: "column",
    },
    orgName: {
        fontSize: 14,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        letterSpacing: 0.3,
    },
    orgTagline: {
        fontSize: 7.5,
        color: "#2563eb",
        letterSpacing: 0.8,
        marginTop: 1,
    },
    orgContact: {
        fontSize: 7,
        color: "#6b7280",
        marginTop: 4,
    },
    headerRight: {
        alignItems: "flex-end",
    },
    docLabel: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#ffffff",
        backgroundColor: "#1e3a8a",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 3,
        marginBottom: 4,
        letterSpacing: 1,
    },
    docMeta: {
        fontSize: 8,
        color: "#374151",
        textAlign: "right",
    },
    // ── Banner ─────────────────────────────────────────
    banner: {
        backgroundColor: "#1e3a8a",
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 12,
        borderRadius: 4,
    },
    bannerTitle: {
        fontSize: 13,
        fontFamily: "Helvetica-Bold",
        color: "#ffffff",
        letterSpacing: 1.2,
        textAlign: "center",
    },
    bannerSub: {
        fontSize: 7.5,
        color: "#93c5fd",
        textAlign: "center",
        marginTop: 2,
        letterSpacing: 0.5,
    },
    // ── Party Info Card ────────────────────────────────
    partyCard: {
        flexDirection: "row",
        borderWidth: 1,
        borderColor: "#dbeafe",
        borderRadius: 4,
        backgroundColor: "#eff6ff",
        padding: 10,
        marginBottom: 12,
        gap: 12,
    },
    partyCol: {
        flex: 1,
    },
    partyLabel: {
        fontSize: 7,
        fontFamily: "Helvetica-Bold",
        color: "#2563eb",
        letterSpacing: 0.8,
        marginBottom: 2,
        textTransform: "uppercase",
    },
    partyName: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginBottom: 1,
    },
    partyMeta: {
        fontSize: 8,
        color: "#374151",
    },
    divider: {
        width: 1,
        backgroundColor: "#bfdbfe",
        marginHorizontal: 4,
    },
    // ── Section text ───────────────────────────────────
    sectionTitle: {
        fontSize: 9.5,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginTop: 12,
        marginBottom: 4,
        paddingBottom: 2,
        borderBottomWidth: 0.75,
        borderBottomColor: "#bfdbfe",
    },
    body: {
        fontSize: 8.5,
        color: "#374151",
        marginBottom: 5,
        lineHeight: 1.55,
    },
    bulletRow: {
        flexDirection: "row",
        marginBottom: 3,
        paddingLeft: 4,
    },
    bulletDot: {
        width: 12,
        fontSize: 14,
        color: "#2563eb",
        lineHeight: 1,
    },
    bulletText: {
        flex: 1,
        fontSize: 8.5,
        color: "#374151",
        lineHeight: 1.5,
    },
    // ── Signatures ────────────────────────────────────
    sigSection: {
        marginTop: 16,
        borderTopWidth: 1.5,
        borderTopColor: "#1e3a8a",
        paddingTop: 10,
    },
    sigHeading: {
        fontSize: 9.5,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    sigGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    sigCard: {
        width: "48%",
        padding: 10,
        marginBottom: 10,
    },
    sigMainCard: {
        width: "48%",
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#2563eb",
        borderRadius: 4,
        backgroundColor: "#eff6ff",
    },
    sigName: {
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        color: "#1e3a8a",
        marginBottom: 1,
    },
    sigRole: {
        fontSize: 7.5,
        color: "#6b7280",
        marginBottom: 6,
    },
    sigBadge: {
        fontSize: 6.5,
        color: "#ffffff",
        backgroundColor: "#2563eb",
        paddingVertical: 1,
        paddingHorizontal: 4,
        borderRadius: 2,
        alignSelf: "flex-start",
        marginBottom: 4,
    },
    sigBox: {
        height: 55,
        marginTop: 6,
        marginBottom: 2,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#1e3a8a",
        paddingBottom: 2,
    },
    sigImg: {
        height: 50,
        width: "auto",
        maxWidth: "90%",
    },
    sigPending: {
        fontSize: 7,
        color: "#b0b8c4",
        textAlign: "center",
    },
    sigDateLine: {
        marginTop: 4,
        borderTopWidth: 0.5,
        borderTopColor: "#e5e7eb",
        paddingTop: 3,
        fontSize: 7,
        color: "#9ca3af",
    },
    // ── Footer ────────────────────────────────────────
    footer: {
        position: "absolute",
        bottom: 22,
        left: 45,
        right: 45,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 6.5,
        color: "#9ca3af",
        borderTopWidth: 0.75,
        borderTopColor: "#e5e7eb",
        paddingTop: 5,
    },
    footerCenter: {
        fontSize: 6.5,
        color: "#b0b8c4",
        textAlign: "center",
    },
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface SigningParty {
    name: string
    role: "TRAINEE" | "BCBA" | "BCaBA"
    bacbId: string
    signatureUrl?: string | null
    isMain?: boolean
}

export interface ContractPDFProps {
    trainee: SigningParty
    supervisors: SigningParty[]
    effectiveDate: Date
    clinic: {
        name: string
        address: string
        phone: string
        email: string
        website: string
        taxId?: string
        logoUrl?: string
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bullet helper
// ─────────────────────────────────────────────────────────────────────────────
function Bullet({ text }: { text: string }) {
    return (
        <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>·</Text>
            <Text style={styles.bulletText}>{text}</Text>
        </View>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Card
// ─────────────────────────────────────────────────────────────────────────────
function SigCard({ party, dateStr }: { party: SigningParty; dateStr: string }) {
    const isMain = party.isMain
    const roleLabel = party.role === "TRAINEE" ? "Trainee" : party.role
    return (
        <View style={isMain ? styles.sigMainCard : styles.sigCard}>
            {isMain && <Text style={styles.sigBadge}>PRIMARY SUPERVISOR</Text>}
            <Text style={styles.sigName}>{party.name}</Text>
            <Text style={styles.sigRole}>
                {roleLabel}{party.role !== "TRAINEE" ? ` (${party.role})` : ""} — BACB # {party.bacbId || "—"}
            </Text>
            <View style={styles.sigBox}>
                {party.signatureUrl ? (
                    <Image src={party.signatureUrl} style={styles.sigImg} />
                ) : (
                    <Text style={styles.sigPending}>Signature pending</Text>
                )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                <Text style={{ fontSize: 6, color: "#9ca3af" }}>Electronic Signature</Text>
                <Text style={{ fontSize: 7, color: "#374151", fontWeight: "bold" }}>Date: {dateStr}</Text>
            </View>
        </View>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function ContractPDF({ trainee, supervisors, effectiveDate, clinic }: ContractPDFProps) {
    const primarySupervisor = supervisors.find(s => s.isMain) ?? supervisors[0]
    const effectiveDateStr = format(effectiveDate, "MMMM d, yyyy")
    const allParties = [...supervisors, trainee]

    return (
        <Document
            title="ABA Supervision Contract"
            author={clinic.name}
            creator={`${clinic.name} — ERP System`}
            subject="BACB Fieldwork Supervision Agreement"
            keywords="ABA, BACB, supervision, contract, fieldwork"
        >
            <Page size="LETTER" style={styles.page}>

                {/* ════════════════════ HEADER ════════════════════ */}
                <View style={styles.headerWrap} fixed>
                    {/* Left: Logo area */}
                    <View style={styles.logoArea}>
                        {clinic.logoUrl ? (
                            <Image src={clinic.logoUrl} style={{ width: 140, marginBottom: 10 }} />
                        ) : null}
                        <Text style={styles.orgName}>{clinic.name.toUpperCase()}</Text>
                        <Text style={styles.orgTagline}>BEHAVIOR ANALYSIS · SUPERVISION · TRAINING</Text>
                        <Text style={styles.orgContact}>
                            {clinic.address}{"\n"}
                            {clinic.phone}  ·  {clinic.email}  ·  {clinic.website}
                        </Text>
                    </View>
                    {/* Right: Document label */}
                    <View style={styles.headerRight}>
                        <Text style={styles.docLabel}>SUPERVISION CONTRACT</Text>
                        <Text style={styles.docMeta}>Effective: {effectiveDateStr}</Text>
                        <Text style={styles.docMeta}>Contract ID: {trainee.bacbId || "—"}</Text>
                    </View>
                </View>

                {/* ════════════════════ BANNER ════════════════════ */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>BACB FIELDWORK SUPERVISION AGREEMENT</Text>
                    <Text style={styles.bannerSub}>Pursuant to the BACB Supervision and Mentoring Standards</Text>
                </View>

                {/* ════════════════════ PARTY INFO ════════════════ */}
                <View style={styles.partyCard}>
                    <View style={styles.partyCol}>
                        <Text style={styles.partyLabel}>Trainee (Supervisee)</Text>
                        <Text style={styles.partyName}>{trainee.name}</Text>
                        <Text style={styles.partyMeta}>BACB ID: {trainee.bacbId || "Pending"}</Text>
                        <Text style={styles.partyMeta}>Credential Sought: BCBA</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.partyCol}>
                        <Text style={styles.partyLabel}>Primary Supervisor</Text>
                        {primarySupervisor ? (
                            <>
                                <Text style={styles.partyName}>{primarySupervisor.name}</Text>
                                <Text style={styles.partyMeta}>
                                    {primarySupervisor.role} — BACB # {primarySupervisor.bacbId || "—"}
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.partyMeta}>Not assigned</Text>
                        )}
                    </View>
                    {supervisors.length > 1 && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.partyCol}>
                                <Text style={styles.partyLabel}>Additional Supervisor(s)</Text>
                                {supervisors.filter(s => !s.isMain).map((s, i) => (
                                    <Text key={i} style={styles.partyMeta}>{s.name} ({s.role})</Text>
                                ))}
                            </View>
                        </>
                    )}
                    <View style={styles.divider} />
                    <View style={styles.partyCol}>
                        <Text style={styles.partyLabel}>Organization</Text>
                        <Text style={styles.partyName}>{clinic.name}</Text>
                        <Text style={styles.partyMeta}>Effective: {effectiveDateStr}</Text>
                    </View>
                </View>

                {/* ════════════════════ PREAMBLE ══════════════════ */}
                <Text style={styles.sectionTitle}>1. Preamble & Purpose</Text>
                <Text style={styles.body}>
                    This Supervision Agreement ("Agreement") is entered into as of {effectiveDateStr}, between {trainee.name} ("Trainee"),
                    and {primarySupervisor?.name ?? "the Supervisor"} ("Supervisor"), on behalf of {clinic.name} ("Organization").
                    The purpose of this Agreement is to establish the terms under which the Supervisor will provide qualified BACB fieldwork
                    supervision to the Trainee, enabling the Trainee to accumulate verified experience hours toward board certification
                    in accordance with the Behavior Analyst Certification Board (BACB) Handbook and applicable state regulations.
                </Text>
                <Text style={styles.body}>
                    Both parties acknowledge that supervision will be conducted in compliance with the BACB's Supervisor Training Curriculum
                    Outline, the Professional and Ethical Compliance Code for Behavior Analysts, and all applicable agency policies.
                </Text>

                {/* ════════════════════ TRAINING GOAL ════════════ */}
                <Text style={styles.sectionTitle}>2. Training Goals & Scope of Work</Text>
                <Text style={styles.body}>
                    The Supervisor agrees to provide structured, quality supervision designed to help the Trainee develop and demonstrate
                    the competencies required for BACB certification. Supervision will focus on, but is not limited to:
                </Text>
                <Bullet text="Design, implementation, and evaluation of behavior analytic programs." />
                <Bullet text="Assessment of behavior and the application of function-based interventions." />
                <Bullet text="Ethical decision-making in applied settings." />
                <Bullet text="Data analysis and graphical display of behavioral data." />
                <Bullet text="Systems support, training, and staff or caregiver instruction." />
                <Bullet text="Documentation standards per BACB and agency requirements." />

                {/* ════════════════════ SUPERVISOR RESP. ═════════ */}
                <Text style={styles.sectionTitle}>3. Supervisor Responsibilities</Text>
                <Text style={styles.body}>
                    The Supervisor shall be a qualified BACB-certificant in good standing and shall fulfill the following obligations for
                    the duration of this Agreement:
                </Text>
                <Bullet text="Provide a minimum of 5% of individual (1:1) supervision hours per calendar month relative to the Trainee's total supervised fieldwork hours accumulated during the same period." />
                <Bullet text="Conduct supervision in a variety of settings and formats, including direct observation of the Trainee performing behavior analytic services." />
                <Bullet text="Review and provide corrective, timely, and constructive written and verbal feedback on the Trainee's work products, data sheets, and program documentation." />
                <Bullet text="Ensure the Trainee operates within the boundaries of their demonstrated competence at all times." />
                <Bullet text="Maintain accurate and complete records of all supervision contacts, including date, format, duration, and content." />
                <Bullet text="Complete, review, and countersign all BACB-required monthly fieldwork experience verification forms or equivalent documents within the designated deadlines." />
                <Bullet text="Provide advance written notice to the Trainee of any planned or unplanned interruption in supervisory availability." />
                <Bullet text="Notify the Organization's designated representative of any professional, ethical, or legal concerns arising during the supervision period." />

                {/* ════════════════════ TRAINEE RESP. ════════════ */}
                <Text style={styles.sectionTitle}>4. Trainee Responsibilities</Text>
                <Bullet text="Maintain accurate, contemporaneous records of all supervised and independent fieldwork hours, updated no less than weekly." />
                <Bullet text="Attend all scheduled supervision sessions prepared with relevant data, program materials, and questions; notify the Supervisor at least 24 hours in advance of any scheduling conflict." />
                <Bullet text="Actively engage in self-monitoring and reflection activities as directed by the Supervisor." />
                <Bullet text="Submit all required documentation (timesheets, activity logs, experience verification forms) to the Supervisor and Organization by the specified deadlines each month." />
                <Bullet text="Immediately notify the Supervisor of any client safety concerns, ethical dilemmas, or situations outside the Trainee's scope of competence." />
                <Bullet text="Adhere to all agency policies, BACB ethical standards, and applicable federal and state regulations at all times." />
                <Bullet text="Not independently implement new procedures, programs, or interventions without prior written or documented verbal approval from the Supervisor." />
                <Bullet text="Complete any required supervisor-directed readings, training modules, or competency checks within agreed-upon timelines." />

                {/* ════════════════════ HOUR REQS. ════════════════ */}
                <Text style={styles.sectionTitle}>5. Hour Requirements & Restrictions</Text>
                <Text style={styles.body}>
                    Supervision hours are governed by the BACB Handbook and this Organization's policies:
                </Text>
                <Bullet text="Maximum supervised hours per month: 130 hours (as of effective date; subject to BACB updates)." />
                <Bullet text="Minimum individual supervision: 5% of total monthly supervised hours must be conducted in 1:1 format with the primary supervisor." />
                <Bullet text="Restricted (concentrated) hours: Shall not exceed 40% of total monthly hours for BCBA-track trainees, or 60% for BCaBA-track trainees." />
                <Bullet text="Group supervision: Permissible in groups of up to 10 trainees; counts toward the required supervision percentage." />
                <Bullet text="Unrestricted hours: May include all other approved behavior analytic activities under appropriate oversight." />

                {/* ════════════════════ COMP & PAYMENT ═══════════ */}
                <Text style={styles.sectionTitle}>6. Compensation & Payment</Text>
                <Text style={styles.body}>
                    The Supervisor's compensation, if any, for supervision services rendered under this Agreement shall be determined and administered
                    exclusively by {clinic.name} in accordance with the Organization's approved fee schedule. The Supervisor acknowledges that
                    payment for supervision is contingent upon the Trainee's enrollment status remaining active and all required documentation
                    being submitted and approved by the designated deadline. No compensation shall be payable for hours that are not properly
                    documented and verified in accordance with BACB requirements.
                </Text>

                {/* ════════════════════ CONFIDENTIALITY ══════════ */}
                <Text style={styles.sectionTitle}>7. Confidentiality & HIPAA Compliance</Text>
                <Text style={styles.body}>
                    Both parties agree to maintain strict confidentiality of all client, patient, and organizational information encountered
                    in the course of supervision activities. The Trainee shall complete, or have already completed, HIPAA training as required
                    by the Organization prior to commencing direct client contact. Any inadvertent disclosure of protected health information
                    must be reported to the Organization's Privacy Officer immediately.
                </Text>

                {/* ════════════════════ TERMINATION ══════════════ */}
                <Text style={styles.sectionTitle}>8. Term & Termination</Text>
                <Text style={styles.body}>
                    This Agreement is effective as of {effectiveDateStr} and shall remain in force until terminated by either party.
                    Termination may occur under the following conditions:
                </Text>
                <Bullet text="Either party provides written notice of intent to terminate, with a minimum of 14 calendar days' advance notice, except where immediate termination is necessary for client safety or ethical obligations." />
                <Bullet text="The Trainee is no longer enrolled as an active student or employee in good standing with the Organization." />
                <Bullet text="The Supervisor's BACB certification lapses, is suspended, or is revoked." />
                <Bullet text="Either party fails to meet the obligations set forth in this Agreement and the failure is not remedied within 10 business days of written notice." />
                <Text style={styles.body}>
                    Upon termination, the Supervisor shall countersign only those experience verification forms covering hours accrued prior
                    to the effective termination date. The Trainee is responsible for securing a replacement supervisor and notifying the
                    BACB of any change in supervisory arrangements.
                </Text>

                {/* ════════════════════ AGREEMENT ════════════════ */}
                <Text style={styles.sectionTitle}>9. Agreement & Acknowledgment</Text>
                <Text style={styles.body}>
                    By signing below, each party certifies that they have read, fully understood, and voluntarily agree to abide by all
                    terms and conditions set forth in this Supervision Agreement. The parties further acknowledge that this Agreement
                    complies with the requirements of the BACB Handbook and that any disputes arising hereunder shall be addressed
                    first through good-faith negotiation and, if unresolved, through mediation facilitated by {clinic.name}.
                    This Agreement constitutes the entire understanding between the parties with respect to its subject matter and
                    supersedes all prior discussions or arrangements.
                </Text>

                {/* ════════════════════ SIGNATURES ═══════════════ */}
                <View style={styles.sigSection} break>
                    <Text style={styles.sigHeading}>10. Signatures</Text>
                    <View style={styles.sigGrid}>
                        {/* Trainee first */}
                        <SigCard party={{ ...trainee, isMain: false }} dateStr={effectiveDateStr} />
                        {/* All supervisors */}
                        {supervisors.map((sup, i) => (
                            <SigCard key={i} party={sup} dateStr={effectiveDateStr} />
                        ))}
                    </View>
                </View>

                {/* ════════════════════ FOOTER (FIXED) ═══════════ */}
                <View style={styles.footer} fixed>
                    <Text>{clinic.name}  ·  {clinic.phone}</Text>
                    <Text style={styles.footerCenter}>
                        CONFIDENTIAL — FOR BACB VERIFICATION PURPOSES ONLY
                    </Text>
                    <Text render={({ pageNumber, totalPages }) =>
                        `Page ${pageNumber} of ${totalPages}`
                    } />
                </View>
            </Page>
        </Document>
    )
}
