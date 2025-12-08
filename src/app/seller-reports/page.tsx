import { getSellers } from '@/lib/db-data';
import SellerReportsClient from './SellerReportsClient';

export default async function SellerReportsPage() {
    const sellers = await getSellers();

    return <SellerReportsClient sellers={sellers} />;
}

