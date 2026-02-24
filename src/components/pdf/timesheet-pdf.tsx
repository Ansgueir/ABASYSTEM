import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from "date-fns";

// Register fonts
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
        padding: 30,
        fontFamily: 'Inter',
        fontSize: 10,
        color: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: 700,
        color: '#111',
    },
    subtitle: {
        fontSize: 11,
        color: '#666',
        marginTop: 4,
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: '#111',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    summaryCard: {
        backgroundColor: '#f8f9fa',
        padding: 10,
        borderRadius: 4,
        minWidth: '30%',
        flexGrow: 1,
    },
    cardLabel: {
        fontSize: 9,
        color: '#666',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    cardValue: {
        fontSize: 14,
        fontWeight: 700,
    },
    table: {
        width: '100%',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        padding: 6,
        fontWeight: 600,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        padding: 6,
        paddingVertical: 8,
    },
    colDate: { width: '15%' },
    colType: { width: '25%' },
    colActivity: { width: '35%' },
    colHours: { width: '10%', textAlign: 'right' },
    colStatus: { width: '15%', textAlign: 'right' },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
        fontSize: 9,
        color: '#999',
    }
});

interface TimesheetPDFProps {
    student: any;
    hours: any[];
    stats: any;
}

export function TimesheetPDF({ student, hours, stats }: TimesheetPDFProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>ABA Supervision Timesheet</Text>
                        <Text style={styles.subtitle}>{student.fullName}</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text>Generated: {format(new Date(), 'MMM d, yyyy')}</Text>
                        <Text style={{ marginTop: 2, color: '#666' }}>Email: {student.user?.email || student.email || 'N/A'}</Text>
                    </View>
                </View>

                {/* Summary Stats */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Independent Hours (Total)</Text>
                        <Text style={styles.cardValue}>{Number(stats.independentHours).toFixed(1)}h</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Supervised Hours (Total)</Text>
                        <Text style={styles.cardValue}>{Number(stats.supervisedHours).toFixed(1)}h</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Total Progress</Text>
                        <Text style={styles.cardValue}>{Number(stats.totalProgress).toFixed(1)}h</Text>
                    </View>
                </View>

                {/* Hours Log Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detailed Hours Log</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.colDate}>Date</Text>
                            <Text style={styles.colType}>Type</Text>
                            <Text style={styles.colActivity}>Activity / Setting</Text>
                            <Text style={styles.colHours}>Hours</Text>
                            <Text style={styles.colStatus}>Status</Text>
                        </View>

                        {hours.length === 0 ? (
                            <View style={[styles.tableRow, { justifyContent: 'center', padding: 15 }]}>
                                <Text style={{ color: '#666' }}>No hours logged yet</Text>
                            </View>
                        ) : (
                            hours.map((hour, i) => (
                                <View key={i} style={styles.tableRow}>
                                    <Text style={styles.colDate}>{format(new Date(hour.date), 'MM/dd/yy')}</Text>
                                    <View style={styles.colType}>
                                        <Text>{hour.type === 'supervised' ? 'Supervised' : 'Independent'}</Text>
                                        {hour.supervisor && <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>{hour.supervisor.fullName}</Text>}
                                    </View>
                                    <View style={styles.colActivity}>
                                        <Text>{hour.activityType?.replace('_', ' ')}</Text>
                                        <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>{hour.setting?.replace('_', ' ')}</Text>
                                    </View>
                                    <Text style={styles.colHours}>{Number(hour.hours).toFixed(1)}h</Text>
                                    <Text style={styles.colStatus}>{hour.status || 'LOGGED'}</Text>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text>ProVault ABA Supervision System</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
