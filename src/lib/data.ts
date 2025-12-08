import * as xlsx from 'xlsx';
import path from 'path';
import 'server-only';
import fs from 'fs';
import { Restaurant, AnalysisResult, Note, FollowUp, Goal, AutomationRule } from './types';

// Types are imported from ./types.ts directly in other files

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'dados.xlsx');

export async function saveStatus(id: string, status: string) {
    const dir = getRestaurantDir(id);
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ status }, null, 2));
}

export async function getStatus(id: string): Promise<string | null> {
    const filePath = path.join(getRestaurantDir(id), 'status.json');
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return data.status;
    }
    return null;
}

export async function getRestaurants(): Promise<Restaurant[]> {
    const dataDir = path.join(process.cwd(), 'data');
    console.log('Scanning directory for data:', dataDir);

    if (!fs.existsSync(dataDir)) {
        console.error(`Directory NOT found at ${dataDir}`);
        return [];
    }

    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.xlsx'));
    console.log(`Found ${files.length} Excel files.`);

    let allRestaurants: Restaurant[] = [];

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        try {
            console.log(`Reading file: ${file}`);
            const fileBuffer = fs.readFileSync(filePath);
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json<any>(sheet);

            const fileRestaurants = await Promise.all(data.map(async (row, index) => {
                // Extract comments dynamically
                const comments: string[] = [];
                // Try standard format "Comentário X"
                for (let i = 1; i <= 50; i++) {
                    const comment = row[`Comentário ${i}`];
                    if (comment) comments.push(comment);
                }
                // Fallback: Check for other common comment column names if needed
                if (comments.length === 0 && row['Comentarios']) {
                    comments.push(row['Comentarios']);
                }

                // Create a unique ID based on filename and index to avoid collisions
                const sanitizedFileName = file.replace(/[^a-zA-Z0-9]/g, '_');
                const id = `rest-${sanitizedFileName}-${index}`;

                const savedStatus = await getStatus(id);

                return {
                    id,
                    name: row['Nome'] || 'Unknown',
                    rating: parseFloat(row['Avaliação']) || 0,
                    reviewCount: parseInt(row['Nº Avaliações']) || 0,
                    totalComments: parseInt(row['Total Comentários']) || 0,
                    projectedDeliveries: parseInt(row['Projeção Entregas/Mês']) || 0,
                    salesPotential: row['Potencial Vendas'] || 'N/A',
                    category: row['Categoria'] || 'N/A',
                    address: {
                        street: row['Endereço (Rua)'] || '',
                        neighborhood: row['Bairro'] || '',
                        city: row['Cidade'] || '',
                        state: row['Estado'] || '',
                        zip: row['CEP'] || '',
                    },
                    lastCollectionDate: row['Data Coleta'] || '',
                    comments: comments,
                    status: savedStatus || (row['Potencial Vendas'] === 'ALTÍSSIMO' ? 'Qualificado' : 'A Analisar')
                };
            }));

            allRestaurants = [...allRestaurants, ...fileRestaurants];
        } catch (error) {
            console.error(`Error reading file ${file}:`, error);
        }
    }

    return allRestaurants;
}

// Persistence Logic
const DATA_DIR = path.join(process.cwd(), 'data', 'restaurants');

function getRestaurantDir(id: string) {
    const dir = path.join(DATA_DIR, id);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export async function saveAnalysis(id: string, analysis: AnalysisResult) {
    const dir = getRestaurantDir(id);
    fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify(analysis, null, 2));
}

export async function getAnalysis(id: string): Promise<AnalysisResult | null> {
    const filePath = path.join(getRestaurantDir(id), 'analysis.json');
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
}

export async function saveNote(id: string, content: string) {
    const dir = getRestaurantDir(id);
    const notesPath = path.join(dir, 'notes.json');
    let notes: Note[] = [];

    if (fs.existsSync(notesPath)) {
        notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    }

    const newNote: Note = {
        id: Date.now().toString(),
        content,
        createdAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2));
    return newNote;
}

export async function getNotes(id: string): Promise<Note[]> {
    const filePath = path.join(getRestaurantDir(id), 'notes.json');
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
}

export async function getDashboardStats() {
    const restaurants = await getRestaurants();
    let hotLeads: Restaurant[] = [];

    for (const r of restaurants) {
        const analysis = await getAnalysis(r.id);
        if (analysis && analysis.score >= 80) {
            hotLeads.push(r);
        }
    }

    return {
        totalRestaurants: restaurants.length,
        hotLeadsCount: hotLeads.length,
        hotLeads: hotLeads.slice(0, 5),
        projectedRevenue: restaurants.reduce((acc, r) => acc + r.projectedDeliveries * 1.5, 0), // Mock calc
    };
}

export async function saveExcelFile(buffer: Buffer) {
    if (!fs.existsSync(path.dirname(EXCEL_FILE_PATH))) {
        fs.mkdirSync(path.dirname(EXCEL_FILE_PATH), { recursive: true });
    }
    fs.writeFileSync(EXCEL_FILE_PATH, buffer);
}

// Follow-up Management
const FOLLOWUPS_FILE = path.join(process.cwd(), 'data', 'followups.json');
const GOALS_FILE = path.join(process.cwd(), 'data', 'goals.json');
const AUTOMATION_FILE = path.join(process.cwd(), 'data', 'automation.json');

export async function saveFollowUp(followUp: FollowUp) {
    let followUps: FollowUp[] = [];
    if (fs.existsSync(FOLLOWUPS_FILE)) {
        followUps = JSON.parse(fs.readFileSync(FOLLOWUPS_FILE, 'utf-8'));
    }
    const index = followUps.findIndex(f => f.id === followUp.id);
    if (index >= 0) {
        followUps[index] = followUp;
    } else {
        followUps.push(followUp);
    }
    fs.writeFileSync(FOLLOWUPS_FILE, JSON.stringify(followUps, null, 2));
}

export async function getFollowUps(restaurantId?: string): Promise<FollowUp[]> {
    if (!fs.existsSync(FOLLOWUPS_FILE)) return [];
    const followUps: FollowUp[] = JSON.parse(fs.readFileSync(FOLLOWUPS_FILE, 'utf-8'));
    if (restaurantId) {
        return followUps.filter(f => f.restaurantId === restaurantId);
    }
    return followUps;
}

export async function getUpcomingFollowUps(): Promise<FollowUp[]> {
    const followUps = await getFollowUps();
    const now = new Date();
    return followUps
        .filter(f => !f.completed && new Date(f.scheduledDate) >= now)
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
}

// Goals Management
export async function saveGoal(goal: Goal) {
    let goals: Goal[] = [];
    if (fs.existsSync(GOALS_FILE)) {
        goals = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf-8'));
    }
    const index = goals.findIndex(g => g.id === goal.id);
    if (index >= 0) {
        goals[index] = goal;
    } else {
        goals.push(goal);
    }
    fs.writeFileSync(GOALS_FILE, JSON.stringify(goals, null, 2));
}

export async function getGoals(): Promise<Goal[]> {
    if (!fs.existsSync(GOALS_FILE)) {
        // Create default goals
        const defaultGoals: Goal[] = [
            {
                id: '1',
                name: 'Meta Mensal de Receita',
                type: 'revenue',
                target: 50000,
                current: 0,
                period: 'monthly',
                startDate: new Date().toISOString(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
                status: 'active'
            },
            {
                id: '2',
                name: 'Novos Clientes',
                type: 'clients',
                target: 20,
                current: 0,
                period: 'monthly',
                startDate: new Date().toISOString(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
                status: 'active'
            }
        ];
        fs.writeFileSync(GOALS_FILE, JSON.stringify(defaultGoals, null, 2));
        return defaultGoals;
    }
    return JSON.parse(fs.readFileSync(GOALS_FILE, 'utf-8'));
}

// Automation Rules
export async function saveAutomationRule(rule: AutomationRule) {
    let rules: AutomationRule[] = [];
    if (fs.existsSync(AUTOMATION_FILE)) {
        rules = JSON.parse(fs.readFileSync(AUTOMATION_FILE, 'utf-8'));
    }
    const index = rules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
        rules[index] = rule;
    } else {
        rules.push(rule);
    }
    fs.writeFileSync(AUTOMATION_FILE, JSON.stringify(rules, null, 2));
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
    if (!fs.existsSync(AUTOMATION_FILE)) {
        // Create default automation rules
        const defaultRules: AutomationRule[] = [
            {
                id: '1',
                name: 'Alto Score → Qualificado',
                condition: { field: 'score', operator: '>=', value: 80 },
                action: { type: 'move_to_stage', value: 'Qualificado' },
                enabled: true
            },
            {
                id: '2',
                name: 'Potencial Altíssimo → Qualificado',
                condition: { field: 'potential', operator: '==', value: 'ALTÍSSIMO' },
                action: { type: 'move_to_stage', value: 'Qualificado' },
                enabled: true
            }
        ];
        fs.writeFileSync(AUTOMATION_FILE, JSON.stringify(defaultRules, null, 2));
        return defaultRules;
    }
    return JSON.parse(fs.readFileSync(AUTOMATION_FILE, 'utf-8'));
}

// Intelligent Client Separation
export async function getIntelligentSegmentation() {
    const restaurants = await getRestaurants();
    const analysisPromises = restaurants.map(r => getAnalysis(r.id));
    const analyses = await Promise.all(analysisPromises);

    const highPotential = restaurants.filter((r, i) => {
        const analysis = analyses[i];
        return (analysis && analysis.score >= 80) || r.salesPotential === 'ALTÍSSIMO';
    });

    const mediumPotential = restaurants.filter((r, i) => {
        const analysis = analyses[i];
        return (analysis && analysis.score >= 60 && analysis.score < 80) || r.salesPotential === 'ALTO';
    });

    const lowPotential = restaurants.filter((r, i) => {
        const analysis = analyses[i];
        return (!analysis || analysis.score < 60) && r.salesPotential !== 'ALTÍSSIMO' && r.salesPotential !== 'ALTO';
    });

    return {
        highPotential,
        mediumPotential,
        lowPotential,
        total: restaurants.length
    };
}

// Recent Activities
export interface Activity {
    id: string;
    type: 'analysis' | 'qualification' | 'followup' | 'email' | 'status_change';
    title: string;
    description: string;
    restaurantId?: string;
    restaurantName?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
    const activities: Activity[] = [];
    const restaurants = await getRestaurants();
    const followUps = await getFollowUps();
    
    // Get recent analyses
    for (const restaurant of restaurants.slice(0, 50)) {
        try {
            const analysis = await getAnalysis(restaurant.id);
            if (analysis) {
                const analysisFile = path.join(getRestaurantDir(restaurant.id), 'analysis.json');
                let analysisDate = new Date();
                if (fs.existsSync(analysisFile)) {
                    analysisDate = fs.statSync(analysisFile).mtime;
                }
                activities.push({
                    id: `analysis-${restaurant.id}`,
                    type: 'analysis',
                    title: 'Análise IA concluída',
                    description: `${restaurant.name} - ${analysis.painPoints?.length || 0} dores identificadas`,
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    timestamp: analysisDate.toISOString(),
                    metadata: {
                        score: analysis.score,
                        painPoints: analysis.painPoints?.slice(0, 2) || []
                    }
                });
            }
        } catch (error) {
            // Skip restaurants with errors
            continue;
        }
    }
    
    // Get recent qualifications
    const qualified = restaurants.filter(r => r.status === 'Qualificado');
    for (const restaurant of qualified.slice(0, 10)) {
        const analysis = await getAnalysis(restaurant.id);
        if (analysis && analysis.score >= 80) {
            activities.push({
                id: `qualification-${restaurant.id}`,
                type: 'qualification',
                title: 'Lead qualificado',
                description: `${restaurant.name} alcançou score ${analysis.score}`,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                timestamp: new Date().toISOString(),
                metadata: {
                    score: analysis.score,
                    city: restaurant.address?.city
                }
            });
        }
    }
    
    // Get recent follow-ups
    const recentFollowUps = followUps
        .filter(f => !f.completed)
        .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
        .slice(0, 10);
    
    for (const followUp of recentFollowUps) {
        const restaurant = restaurants.find(r => r.id === followUp.restaurantId);
        if (restaurant) {
            const typeLabels: Record<string, string> = {
                call: 'Ligação',
                email: 'Email',
                meeting: 'Reunião',
                whatsapp: 'WhatsApp'
            };
            
            activities.push({
                id: `followup-${followUp.id}`,
                type: 'followup',
                title: `Follow-up agendado: ${typeLabels[followUp.type] || 'Tarefa'}`,
                description: `${restaurant.name} - ${followUp.notes || followUp.emailSubject || 'Sem notas'}`,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                timestamp: followUp.scheduledDate,
                metadata: {
                    type: followUp.type,
                    scheduledDate: followUp.scheduledDate
                }
            });
        }
    }
    
    // Sort by timestamp and return most recent
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
}
