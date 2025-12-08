import { getRestaurants } from '@/lib/db-data';
import ClientsClientNew from './ClientsClientNew';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const restaurants = await getRestaurants();

    return <ClientsClientNew initialRestaurants={restaurants} />;
}
