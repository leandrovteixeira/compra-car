import { StyleSheet } from '@react-pdf/renderer';

export const comparisonPdfStyles = StyleSheet.create({
  page: {
    backgroundColor: '#020617',
    color: '#f1f5f9',
    fontFamily: 'Helvetica',
    padding: 40,
  },
  eyebrow: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 10,
  },
  summary: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 1.5,
  },
  surface: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
    padding: 20,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  vehicle: {
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
    fontSize: 12,
    paddingBottom: 9,
    paddingTop: 9,
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  metric: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    flexGrow: 1,
    padding: 12,
  },
  metricValue: {
    color: '#67e8f9',
    fontSize: 18,
    fontWeight: 700,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 8,
    marginTop: 4,
  },
});
