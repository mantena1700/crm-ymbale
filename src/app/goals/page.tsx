import { getRestaurants, getGoals } from '@/lib/db-data';
import GoalsClient from './GoalsClient';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
    const restaurants = await getRestaurants();
    const goals = await getGoals();
    
    // Calculate stats
    const stats = {
        totalLeads: restaurants.length,
        qualifiedLeads: restaurants.filter(r => r.status === 'Qualificado').length,
        closedDeals: restaurants.filter(r => r.status === 'Fechado').length,
        totalRevenue: 0, // Would come from actual sales data
        avgDealSize: 2500,
        conversionRate: restaurants.length > 0 
            ? Math.round((restaurants.filter(r => r.status === 'Fechado').length / restaurants.length) * 100)
            : 0
    };
    
    return <GoalsClient initialGoals={goals} stats={stats} />;
}
