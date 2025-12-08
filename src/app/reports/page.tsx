import { getReportMetrics } from './actions';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
    const metrics = await getReportMetrics();
    
    return <ReportsClient initialMetrics={metrics} />;
}
