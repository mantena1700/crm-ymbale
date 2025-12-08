import CampaignsClient from './CampaignsClient';
import { getCampaigns, getEmailTemplates } from './actions';
import { getWorkflows } from './workflow-actions';
import { getSellers } from '@/lib/db-data';

export default async function CampaignsPage() {
    const [campaigns, workflows, templates, sellers] = await Promise.all([
        getCampaigns(),
        getWorkflows(),
        getEmailTemplates(),
        getSellers()
    ]);

    return (
        <CampaignsClient 
            initialCampaigns={campaigns}
            initialWorkflows={workflows}
            initialTemplates={templates}
            initialSellers={sellers}
        />
    );
}

