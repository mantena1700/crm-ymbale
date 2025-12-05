import { getRestaurants } from '@/lib/db-data';
import ClientsClient from './ClientsClient';

export default async function ClientsPage() {
    const restaurants = await getRestaurants();

    return <ClientsClient initialRestaurants={restaurants} />;
}
