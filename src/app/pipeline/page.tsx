import { getPipelineData } from './actions';
import PipelineClient from './PipelineClient';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
    const { restaurants, metrics } = await getPipelineData();

    return (
        <PipelineClient 
            initialRestaurants={restaurants} 
            initialMetrics={metrics}
        />
    );
}
