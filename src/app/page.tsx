import { getDashboardStats, getRestaurants, getFollowUps, getGoals, getUpcomingFollowUps, getRecentActivities, Activity } from '@/lib/db-data';
import DashboardClientNew from './DashboardClientNew';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
    const stats = await getDashboardStats();
    const restaurants = await getRestaurants();
    const followUps = await getFollowUps();
    const upcomingFollowUps = await getUpcomingFollowUps();
    const goals = await getGoals();
    const recentActivities = await getRecentActivities(10);
    
    // Calculate advanced stats
    const advancedStats = {
        ...stats,
        totalLeads: restaurants.length,
        qualifiedLeads: restaurants.filter(r => r.status === 'Qualificado').length,
        contactedLeads: restaurants.filter(r => r.status === 'Contatado').length,
        negotiatingLeads: restaurants.filter(r => r.status === 'Negociação').length,
        closedDeals: restaurants.filter(r => r.status === 'Fechado').length,
        pendingAnalysis: restaurants.filter(r => !r.status || r.status === 'A Analisar').length,
        avgRating: restaurants.length > 0 
            ? (restaurants.reduce((sum, r) => sum + r.rating, 0) / restaurants.length).toFixed(1)
            : '0',
        byPotential: {
            altissimo: restaurants.filter(r => r.salesPotential === 'ALTÍSSIMO').length,
            alto: restaurants.filter(r => r.salesPotential === 'ALTO').length,
            medio: restaurants.filter(r => r.salesPotential === 'MÉDIO').length,
            baixo: restaurants.filter(r => r.salesPotential === 'BAIXO').length,
        },
        byRegion: restaurants.reduce((acc, r) => {
            const city = r.address?.city || 'Outros';
            acc[city] = (acc[city] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
        recentLeads: restaurants.slice(0, 5),
        topLeads: restaurants
            .filter(r => r.salesPotential === 'ALTÍSSIMO')
            .sort((a, b) => b.projectedDeliveries - a.projectedDeliveries)
            .slice(0, 10),
        pendingFollowUps: followUps.filter(f => !f.completed).length,
        todayFollowUps: followUps.filter(f => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const fDate = new Date(f.scheduledDate);
            fDate.setHours(0, 0, 0, 0);
            return fDate.getTime() === today.getTime() && !f.completed;
        }).length,
        upcomingFollowUps: upcomingFollowUps.slice(0, 5).map(f => {
            const restaurant = restaurants.find(r => r.id === f.restaurantId);
            return {
                ...f,
                restaurantName: restaurant?.name || 'Restaurante'
            };
        }),
        goals: goals.slice(0, 3),
        recentActivities: recentActivities
    };

    return <DashboardClientNew stats={advancedStats} />;
}
