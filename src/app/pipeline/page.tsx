import { getPipelineData } from './actions';
import PipelineClient from './PipelineClient';

export default async function PipelinePage() {
    const { restaurants, metrics } = await getPipelineData();

    return (
        <PipelineClient 
            initialRestaurants={restaurants} 
            initialMetrics={metrics}
        />
    );
}
