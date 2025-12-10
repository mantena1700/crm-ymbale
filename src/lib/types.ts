export interface Seller {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    regions: string[];
    neighborhoods: string[];
    active: boolean;
}

export interface Restaurant {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
    totalComments: number;
    projectedDeliveries: number;
    salesPotential: string;
    address: {
        street: string;
        neighborhood: string;
        city: string;
        state: string;
        zip: string;
    };
    lastCollectionDate: string;
    comments: string[];
    status?: string;
    seller?: Seller;
    assignedAt?: string;
    zonaId?: string;
    zonaNome?: string;
}

export interface AnalysisResult {
    restaurantId: string;
    score: number;
    summary: string;
    painPoints: string[];
    salesCopy: string;
    strategy?: string;
    status: 'To Analyze' | 'Qualified' | 'Contacted' | 'Negotiation' | 'Closed' | 'A Analisar' | 'Qualificado' | 'Negociação';
}

export interface Note {
    id: string;
    content: string;
    createdAt: string;
}

export interface FollowUp {
    id: string;
    restaurantId: string;
    type: 'email' | 'call' | 'meeting';
    scheduledDate: string;
    completed: boolean;
    completedDate?: string;
    notes?: string;
    emailSubject?: string;
    emailBody?: string;
    emailSent?: boolean;
}

export interface Goal {
    id: string;
    name: string;
    type: 'revenue' | 'clients' | 'conversion' | 'custom' | 'leads' | 'conversions' | 'calls' | 'meetings';
    target: number;
    current: number;
    period: 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'paused';
}

export interface AutomationRule {
    id: string;
    name: string;
    condition: {
        field: 'score' | 'potential' | 'status' | 'rating';
        operator: '>' | '<' | '>=' | '<=' | '==';
        value: string | number;
    };
    action: {
        type: 'move_to_stage' | 'send_email' | 'create_followup';
        value: string;
    };
    enabled: boolean;
}

export interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    restaurantId?: string;
    restaurantName?: string;
    timestamp: string;
    metadata: any;
}

export interface Visit {
    id: string;
    restaurantId: string;
    sellerId: string;
    visitDate: string;
    feedback?: string;
    outcome?: 'positive' | 'neutral' | 'negative' | 'scheduled';
    nextVisitDate?: string;
    followUpId?: string;
    createdAt: string;
    updatedAt: string;
    restaurantName?: string;
    sellerName?: string;
}