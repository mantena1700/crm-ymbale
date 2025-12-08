import { getFollowUps, getRestaurants } from '@/lib/db-data';
import AgendaClient from './AgendaClient';

export default async function AgendaPage() {
    const followUps = await getFollowUps();
    const restaurants = await getRestaurants();
    
    // Enrich follow-ups with restaurant data
    const enrichedFollowUps = followUps.map(f => ({
        ...f,
        restaurant: restaurants.find(r => r.id === f.restaurantId)
    }));
    
    return <AgendaClient initialFollowUps={enrichedFollowUps} restaurants={restaurants} />;
}

