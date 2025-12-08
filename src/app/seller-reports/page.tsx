import { getSellers } from '@/lib/db-data';
import SellerReportsClient from './SellerReportsClient';

export const dynamic = 'force-dynamic';

export default async function SellerReportsPage() {
    const sellers = await getSellers();

    return <SellerReportsClient sellers={sellers} />;
}

