import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from "date-fns";

// Register fonts for varied weights
Font.register({
    family: 'Inter',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf', fontWeight: 600 },
        { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf', fontWeight: 700 }
    ]
});

const styles = StyleSheet.create({
    page: {
        paddingTop: 50,
        paddingBottom: 50,
        paddingHorizontal: 40,
        fontFamily: 'Inter',
        fontSize: 10,
        color: '#1e293b',
        backgroundColor: '#ffffff'
    },
    brandLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: '#6366f1' // Sharp Indigo accent
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e2e8f0',
    },
    title: {
        fontSize: 24,
        fontWeight: 700,
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: '#6366f1',
        marginTop: 6,
        fontWeight: 600,
    },
    metaBlock: {
        alignItems: 'flex-end',
    },
    metaLabel: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metaText: {
        fontSize: 10,
        color: '#475569',
        marginTop: 4,
        fontWeight: 600,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: 12,
        letterSpacing: -0.2,
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    summaryCard: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        borderRadius: 8,
        width: '31%',
    },
    cardLabel: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: 600,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 700,
        color: '#0f172a',
    },
    tableWrapper: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableHeaderText: {
        fontSize: 9,
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    tableRowAlt: {
        backgroundColor: '#fafafa'
    },
    colDate: { width: '15%' },
    colType: { width: '25%' },
    colActivity: { width: '30%' },
    colHours: { width: '12%', textAlign: 'right' },
    colStatus: { width: '18%', alignItems: 'flex-end', justifyContent: 'center' },
    textBold: {
        fontWeight: 600,
        color: '#0f172a',
    },
    textSub: {
        fontSize: 8,
        color: '#64748b',
        marginTop: 3,
        textTransform: 'uppercase',
    },
    pillBox: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    pillText: {
        fontSize: 8,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bgSuccess: { backgroundColor: '#dcfce7' },
    textSuccess: { color: '#166534' },
    bgPending: { backgroundColor: '#fef9c3' },
    textPending: { color: '#854d0e' },
    bgBlue: { backgroundColor: '#e0e7ff' },
    textBlue: { color: '#3730a3' },
    bgDefault: { backgroundColor: '#f1f5f9' },
    textDefault: { color: '#475569' },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 12,
    },
    footerText: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: 600,
    }
});

interface TimesheetPDFProps {
    student: any;
    hours: any[];
    stats: any;
}

export function TimesheetPDF({ student, hours, stats }: TimesheetPDFProps) {
    const getStatusStyle = (status: string) => {
        const s = status?.toLowerCase() || 'logged';
        if (s === 'approved') return [styles.bgSuccess, styles.textSuccess];
        if (s === 'pending') return [styles.bgPending, styles.textPending];
        if (s === 'billed') return [styles.bgBlue, styles.textBlue];
        return [styles.bgDefault, styles.textDefault];
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.brandLine} fixed />

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Supervision Timesheet</Text>
                        <Text style={styles.subtitle}>{student.fullName}</Text>
                    </View>
                    <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>Generated On</Text>
                        <Text style={styles.metaText}>{format(new Date(), 'MMMM d, yyyy')}</Text>
                        <Text style={[styles.metaLabel, { marginTop: 10 }]}>Email</Text>
                        <Text style={styles.metaText}>{student.user?.email || student.email || 'N/A'}</Text>
                    </View>
                </View>

                {/* Summary Stats */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Independent Hours</Text>
                        <Text style={styles.cardValue}>{Number(stats.independentHours).toFixed(1)} <Text style={{ fontSize: 12, color: '#64748b' }}>h</Text></Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Supervised Hours</Text>
                        <Text style={styles.cardValue}>{Number(stats.supervisedHours).toFixed(1)} <Text style={{ fontSize: 12, color: '#64748b' }}>h</Text></Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Total Progress</Text>
                        <Text style={styles.cardValue}>{Number(stats.totalProgress).toFixed(1)} <Text style={{ fontSize: 12, color: '#64748b' }}>h</Text></Text>
                    </View>
                </View>

                {/* Hours Log Table */}
                <View style={{ marginBottom: 15 }}>
                    <Text style={styles.sectionTitle}>Detailed Hours Log</Text>
                    <View style={styles.tableWrapper}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.colDate, styles.tableHeaderText]}>Date</Text>
                            <Text style={[styles.colType, styles.tableHeaderText]}>Type</Text>
                            <Text style={[styles.colActivity, styles.tableHeaderText]}>Activity / Setting</Text>
                            <Text style={[styles.colHours, styles.tableHeaderText]}>Duration</Text>
                            <View style={styles.colStatus}>
                                <Text style={styles.tableHeaderText}>Status</Text>
                            </View>
                        </View>

                        {hours.length === 0 ? (
                            <View style={[styles.tableRow, { justifyContent: 'center', paddingVertical: 24 }]}>
                                <Text style={{ color: '#94a3b8', fontStyle: 'italic' }}>No registered hours found in the system for this student.</Text>
                            </View>
                        ) : (
                            hours.map((hour, i) => {
                                const [boxStyle, textStyle] = getStatusStyle(hour.status);
                                return (
                                    <View key={i} style={[styles.tableRow, i % 2 !== 0 && styles.tableRowAlt]} wrap={false}>
                                        {/* Date Component */}
                                        <View style={styles.colDate}>
                                            <Text style={styles.textBold}>{format(new Date(hour.date), 'MM/dd/yy')}</Text>
                                            <Text style={styles.textSub}>{format(new Date(hour.startTime || hour.date), 'h:mm a')}</Text>
                                        </View>

                                        {/* Type Component */}
                                        <View style={styles.colType}>
                                            <Text style={styles.textBold}>{hour.type === 'supervised' ? 'Supervised' : 'Independent'}</Text>
                                            {hour.supervisor && <Text style={styles.textSub}>By: {hour.supervisor.fullName}</Text>}
                                        </View>

                                        {/* Activity Component */}
                                        <View style={styles.colActivity}>
                                            <Text style={styles.textBold}>{hour.activityType?.replace('_', ' ')}</Text>
                                            <Text style={styles.textSub}>{hour.setting?.replace('_', ' ')}</Text>
                                        </View>

                                        {/* Hours Component */}
                                        <Text style={[styles.colHours, styles.textBold]}>{Number(hour.hours).toFixed(1)}h</Text>

                                        {/* Status Component */}
                                        <View style={styles.colStatus}>
                                            <View style={[styles.pillBox, boxStyle]}>
                                                <Text style={[styles.pillText, textStyle]}>{hour.status || 'LOGGED'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                )
                            })
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>ProVault ABA Supervision System</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
