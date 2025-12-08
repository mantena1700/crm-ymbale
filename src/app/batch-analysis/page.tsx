import { getRestaurants } from '@/lib/db-data';
import { Restaurant } from '@/lib/types';
import BatchAnalysisClient from './BatchAnalysisClient';

export default async function BatchAnalysisPage() {
    const restaurants = await getRestaurants();
    const toAnalyze = restaurants.filter(r => !r.status || r.status === 'A Analisar');

    return <BatchAnalysisClient toAnalyze={toAnalyze} />;
}
