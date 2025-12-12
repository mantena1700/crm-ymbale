'use server';

import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { saveFollowUp, getFollowUps, saveGoal, getGoals, getRestaurants, getAnalysis, saveStatus, saveAnalysis, saveNote } from '@/lib/db-data';
import { FollowUp, Restaurant, AnalysisResult, Note } from '@/lib/types';
import { generateEmailWithAI as generateEmail, generateStrategyWithAI as generateStrategy, generateFollowUpMessageWithAI as generateFollowUp } from '@/lib/openai-service';
import { analyzeRestaurant } from '@/lib/ai-service';

// Função para criar notificações automaticamente
async function createSystemNotification(type: string, title: string, message: string, metadata?: any) {
    try {
        const { prisma } = await import('@/lib/db');
        await prisma.notification.create({
            data: {
                type,
                title,
                message,
                metadata: metadata || {},
                read: false
            }
        });
        revalidatePath('/notifications');
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
    }
}

export async function updateRestaurantStatus(id: string, newStatus: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === id);

    if (restaurant) {
        const oldStatus = restaurant.status;
        restaurant.status = newStatus;
        await saveStatus(id, newStatus);

        // Criar notificação para mudanças de status importantes
        if (newStatus === 'Fechado') {
            await createSystemNotification(
                'success',
                '🎉 Negócio Fechado!',
                `${restaurant.name} foi convertido com sucesso!`,
                { restaurantId: id }
            );
        } else if (newStatus === 'Qualificado') {
            await createSystemNotification(
                'lead',
                '🎯 Lead Qualificado',
                `${restaurant.name} foi qualificado para abordagem comercial.`,
                { restaurantId: id }
            );
        }

        revalidatePath('/pipeline');
        revalidatePath(`/restaurant/${id}`);
        revalidatePath('/clients');
    }
}

export async function updateRestaurantSeller(id: string, sellerId: string | null) {
    const { prisma } = await import('@/lib/db');
    await prisma.restaurant.update({
        where: { id },
        data: {
            sellerId: sellerId,
            assignedAt: sellerId ? new Date() : null
        }
    });
    revalidatePath(`/restaurant/${id}`);
    revalidatePath('/pipeline');
    revalidatePath('/clients');
}

export async function performAnalysis(id: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === id);

    if (restaurant) {
        const analysis = await analyzeRestaurant(restaurant);
        await saveAnalysis(id, analysis);

        // Criar notificação de análise concluída
        await createSystemNotification(
            'analysis',
            '🤖 Análise IA Concluída',
            `Análise de ${restaurant.name} finalizada. Score: ${analysis.score}/100`,
            { restaurantId: id, score: analysis.score }
        );

        // Notificação extra para leads quentes
        if (analysis.score >= 80) {
            await createSystemNotification(
                'lead',
                '🔥 Lead Quente Detectado!',
                `${restaurant.name} tem alto potencial (Score: ${analysis.score}). Priorizar contato!`,
                { restaurantId: id, score: analysis.score }
            );
        }

        revalidatePath(`/restaurant/${id}`);
        revalidatePath('/clients');
        return analysis;
    }
}

export async function analyzeBatch(restaurants: Restaurant[]) {
    for (const restaurant of restaurants) {
        await performAnalysis(restaurant.id);
    }
    revalidatePath('/batch-analysis');
    return { success: true };
}

export async function createFollowUp(restaurantId: string, type: 'email' | 'call' | 'meeting', scheduledDate: string, emailSubject?: string, emailBody?: string) {
    const followUp: FollowUp = {
        id: Date.now().toString(),
        restaurantId,
        type,
        scheduledDate,
        completed: false,
        emailSubject,
        emailBody,
        emailSent: false
    };

    await saveFollowUp(followUp);
    revalidatePath('/pipeline');
    revalidatePath(`/restaurant/${restaurantId}`);
    return followUp;
}

export async function sendEmail(restaurantId: string, subject: string, body: string) {
    const followUps = await getFollowUps(restaurantId);
    const followUp = followUps.find(f => f.emailSubject === subject && !f.emailSent);

    if (followUp) {
        followUp.emailSent = true;
        followUp.completed = true;
        followUp.completedDate = new Date().toISOString();
        await saveFollowUp(followUp);
    }

    revalidatePath('/pipeline');
    revalidatePath(`/restaurant/${restaurantId}`);
    return { success: true, message: 'Email enviado com sucesso!' };
}

export async function completeFollowUp(followUpId: string) {
    const followUps = await getFollowUps();
    const followUp = followUps.find(f => f.id === followUpId);

    if (followUp) {
        followUp.completed = true;
        followUp.completedDate = new Date().toISOString();
        await saveFollowUp(followUp);
    }

    revalidatePath('/pipeline');
    return { success: true };
}

export async function updateGoal(goalId: string, current: number) {
    const goals = await getGoals();
    const goal = goals.find(g => g.id === goalId);

    if (goal) {
        goal.current = current;
        if (current >= goal.target) {
            goal.status = 'completed';
        }
        await saveGoal(goal);
    }

    revalidatePath('/goals');
    return { success: true };
}

export async function addNote(restaurantId: string, content: string) {
    await saveNote(restaurantId, content);
    revalidatePath(`/restaurant/${restaurantId}`);
    return { success: true };
}

export async function generateEmailWithAI(restaurantId: string, customInstructions?: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante nÃ£o encontrado');
    }

    const analysis = await getAnalysis(restaurantId);
    const result = await generateEmail(restaurant, analysis, customInstructions);

    return result;
}

export async function generateStrategyWithAI(restaurantId: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante nÃ£o encontrado');
    }

    const analysis = await getAnalysis(restaurantId);
    const result = await generateStrategy(restaurant, analysis);

    return { strategy: result };
}

export async function generateFollowUpMessageWithAI(restaurantId: string, previousContact?: string) {
    const restaurants = await getRestaurants();
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
        throw new Error('Restaurante nÃ£o encontrado');
    }

    const result = await generateFollowUp(restaurant, previousContact);

    return { message: result };
}

export async function uploadData(formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file uploaded');
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    const filePath = path.join(dataDir, 'dados.xlsx');
    fs.writeFileSync(filePath, buffer);

    revalidatePath('/settings');
    revalidatePath('/clients');
    revalidatePath('/pipeline');
    revalidatePath('/');

    return { success: true };
}

// Nova action para importar Excel diretamente para o banco (múltiplos arquivos)
// Função para parsear arquivo de texto (formato bloco de notas)
async function parseTextFile(file: File): Promise<any[]> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const restaurants: any[] = [];
    
    if (lines.length === 0) return restaurants;
    
    // Detectar formato do arquivo
    // Formato 1: Linhas separadas por delimitador (|, ;, tab, etc)
    const delimiter = text.includes('|') ? '|' : 
                     text.includes(';') ? ';' : 
                     text.includes('\t') ? '\t' : ',';
    
    // Verificar se tem cabeçalho
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('nome') || 
                     firstLine.includes('restaurante') ||
                     firstLine.includes('cidade') ||
                     firstLine.includes('avaliação') ||
                     firstLine.includes('rating');
    
    const startIndex = hasHeader ? 1 : 0;
    
    // Se tem cabeçalho, processar como delimitado
    if (hasHeader && lines.length > 1) {
        const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(delimiter).map(p => p.trim());
            const restaurant: any = { comments: [] };
            
            header.forEach((field, index) => {
                if (parts[index] !== undefined) {
                    const value = parts[index].trim();
                    if (!value) return;
                    
                    // Mapear campos usando os mesmos nomes que o Excel espera
                    if (field.includes('nome') || field.includes('restaurante')) {
                        restaurant['Nome'] = value;
                        restaurant.name = value;
                    } else if (field.includes('cidade') || field.includes('city')) {
                        restaurant['Cidade'] = value;
                        restaurant.city = value;
                    } else if (field.includes('avaliação') || field.includes('rating') || field.includes('nota')) {
                        restaurant['Avaliação'] = value;
                        restaurant.rating = parseFloat(value.replace(',', '.')) || 0;
                    } else if (field.includes('avaliações') || field.includes('reviews') || field.includes('nº avaliações')) {
                        restaurant['Nº Avaliações'] = value;
                        restaurant.reviewCount = parseInt(value.replace(/[^\d]/g, '')) || 0;
                    } else if (field.includes('comentário') || field.includes('comment')) {
                        restaurant.comments.push(value);
                        // Também adicionar como coluna numerada para compatibilidade
                        const commentIndex = restaurant.comments.length;
                        restaurant[`Comentário ${commentIndex}`] = value;
                    } else if (field.includes('bairro') || field.includes('neighborhood')) {
                        restaurant['Bairro'] = value;
                        restaurant.neighborhood = value;
                    } else if (field.includes('estado') || field.includes('state') || field.includes('uf')) {
                        restaurant['Estado'] = value;
                        restaurant.state = value;
                    } else if (field.includes('cep') || field.includes('zip')) {
                        restaurant['CEP'] = value;
                        restaurant.zip = value;
                    } else if (field.includes('endereço') || field.includes('rua') || field.includes('street')) {
                        restaurant['Endereço (Rua)'] = value;
                        restaurant.street = value;
                    } else if (field.includes('potencial') || field.includes('potential')) {
                        restaurant['Potencial Vendas'] = value;
                        restaurant.salesPotential = value;
                    } else if (field.includes('entregas') || field.includes('deliveries')) {
                        restaurant['Projeção Entregas/Mês'] = value;
                        restaurant.projectedDeliveries = parseInt(value.replace(/[^\d]/g, '')) || 0;
                    } else {
                        // Adicionar campo genérico para compatibilidade
                        restaurant[field] = value;
                    }
                }
            });
            
            if (restaurant.name) {
                restaurants.push(restaurant);
            }
        }
    } else {
        // Formato sem cabeçalho: tentar detectar campos por padrões
        let currentRestaurant: any = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                // Linha vazia pode indicar fim de um restaurante
                if (currentRestaurant && currentRestaurant.name) {
                    restaurants.push(currentRestaurant);
                    currentRestaurant = null;
                }
                continue;
            }
            
            // Detectar início de novo restaurante
            if (!currentRestaurant || line.match(/^(Nome|Restaurante)[:\s]/i)) {
                if (currentRestaurant && currentRestaurant.name) {
                    restaurants.push(currentRestaurant);
                }
                currentRestaurant = { comments: [] };
            }
            
            // Buscar campos por padrões e mapear para formato compatível com Excel
            const nameMatch = line.match(/(?:Nome|Restaurante)[:\s]+(.+)/i);
            if (nameMatch) {
                const name = nameMatch[1].trim();
                currentRestaurant['Nome'] = name;
                currentRestaurant.name = name;
                continue;
            }
            
            const cityMatch = line.match(/(?:Cidade|City)[:\s]+(.+)/i);
            if (cityMatch) {
                const city = cityMatch[1].trim();
                currentRestaurant['Cidade'] = city;
                currentRestaurant.city = city;
                continue;
            }
            
            const ratingMatch = line.match(/(?:Avaliação|Rating|Nota)[:\s]+([\d,\.]+)/i);
            if (ratingMatch) {
                const rating = parseFloat(ratingMatch[1].replace(',', '.')) || 0;
                currentRestaurant['Avaliação'] = rating;
                currentRestaurant.rating = rating;
                continue;
            }
            
            const reviewMatch = line.match(/(?:Nº|Número|Total)\s*(?:Avaliações|Reviews)[:\s]+(\d+)/i);
            if (reviewMatch) {
                const reviewCount = parseInt(reviewMatch[1]) || 0;
                currentRestaurant['Nº Avaliações'] = reviewCount;
                currentRestaurant.reviewCount = reviewCount;
                continue;
            }
            
            const commentMatch = line.match(/(?:Comentário|Comment)[:\s]+(.+)/i);
            if (commentMatch) {
                const comment = commentMatch[1].trim();
                currentRestaurant.comments.push(comment);
                const commentIndex = currentRestaurant.comments.length;
                currentRestaurant[`Comentário ${commentIndex}`] = comment;
                continue;
            }
            
            // Buscar outros campos comuns
            const bairroMatch = line.match(/(?:Bairro|Neighborhood)[:\s]+(.+)/i);
            if (bairroMatch) {
                currentRestaurant['Bairro'] = bairroMatch[1].trim();
                currentRestaurant.neighborhood = bairroMatch[1].trim();
                continue;
            }
            
            const estadoMatch = line.match(/(?:Estado|State|UF)[:\s]+(.+)/i);
            if (estadoMatch) {
                currentRestaurant['Estado'] = estadoMatch[1].trim();
                currentRestaurant.state = estadoMatch[1].trim();
                continue;
            }
            
            const cepMatch = line.match(/(?:CEP|Zip)[:\s]+(.+)/i);
            if (cepMatch) {
                currentRestaurant['CEP'] = cepMatch[1].trim();
                currentRestaurant.zip = cepMatch[1].trim();
                continue;
            }
            
            const potencialMatch = line.match(/(?:Potencial|Potential)[:\s]+(.+)/i);
            if (potencialMatch) {
                currentRestaurant['Potencial Vendas'] = potencialMatch[1].trim();
                currentRestaurant.salesPotential = potencialMatch[1].trim();
                continue;
            }
            
            // Se não parece ser um campo estruturado, pode ser comentário ou parte do nome
            if (line.length > 10 && !line.match(/^[A-Z][^:]+:\s*[A-Z]/)) {
                if (!currentRestaurant.name && line.length < 100) {
                    // Pode ser o nome se ainda não tiver nome
                    currentRestaurant['Nome'] = line;
                    currentRestaurant.name = line;
                } else if (line.length > 20) {
                    // Pode ser um comentário
                    currentRestaurant.comments.push(line);
                    const commentIndex = currentRestaurant.comments.length;
                    currentRestaurant[`Comentário ${commentIndex}`] = line;
                }
            }
        }
        
        // Adicionar último restaurante
        if (currentRestaurant && currentRestaurant.name) {
            restaurants.push(currentRestaurant);
        }
    }
    
    return restaurants;
}

export async function importExcelFile(formData: FormData) {
    'use server';

    const { prisma } = await import('@/lib/db');
    const xlsx = await import('xlsx');

    // Obter todos os arquivos (suporta múltiplos - Excel e TXT)
    const files = formData.getAll('files') as File[];
    if (files.length === 0) {
        return {
            success: false,
            message: 'Nenhum arquivo enviado'
        };
    }

    try {
        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let processedFiles = 0;

        // Função para limpar CEP
        const cleanCep = (cep: string): string => {
            return cep.replace(/[^0-9]/g, '');
        };

        // Função para encontrar zona por CEP (usar modelo se disponível, senão SQL direto)
        const findZonaByCep = async (cep: string): Promise<string | null> => {
            try {
                // Limpar e validar CEP
                const cleanedCep = cleanCep(cep);
                if (cleanedCep.length !== 8) {
                    return null;
                }

                // Validar se é um número válido
                const cepNum = parseInt(cleanedCep, 10);
                if (isNaN(cepNum) || cepNum <= 0) {
                    return null;
                }

                let zonas: any[] = [];
                
                // Tentar usar modelo se disponível, senão SQL direto
                if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                    zonas = await (prisma as any).zonaCep.findMany({
                        where: {
                            ativo: true
                        }
                    });
                } else {
                    // Fallback: usar SQL direto
                    const result = await prisma.$queryRaw<Array<{
                        id: string;
                        zona_nome: string;
                        cep_inicial: string;
                        cep_final: string;
                        ativo: boolean;
                    }>>`SELECT * FROM zonas_cep WHERE ativo = true`;
                    zonas = result.map(z => ({
                        id: z.id,
                        zonaNome: z.zona_nome,
                        cepInicial: z.cep_inicial,
                        cepFinal: z.cep_final,
                        ativo: z.ativo
                    }));
                }

                if (zonas.length === 0) {
                    return null;
                }

                // Buscar zona que contém o CEP
                for (const zona of zonas) {
                    const cepInicial = (zona as any).cepInicial || (zona as any).cep_inicial;
                    const cepFinal = (zona as any).cepFinal || (zona as any).cep_final;
                    
                    if (!cepInicial || !cepFinal) {
                        continue;
                    }
                    
                    const zonaInicio = parseInt(cleanCep(cepInicial), 10);
                    const zonaFim = parseInt(cleanCep(cepFinal), 10);
                    
                    // Validar se os CEPs da zona são válidos
                    if (isNaN(zonaInicio) || isNaN(zonaFim) || zonaInicio <= 0 || zonaFim <= 0) {
                        continue;
                    }
                    
                    // Verificar se o CEP está dentro do range
                    if (cepNum >= zonaInicio && cepNum <= zonaFim) {
                        return (zona as any).id;
                    }
                }

                return null;
            } catch (error) {
                console.error('Erro ao buscar zona por CEP:', error);
                return null;
            }
        };

        // Função para encontrar executivo pela zona (usar modelo se disponível, senão SQL direto)
        const findSellerByZona = async (zonaId: string): Promise<string | null> => {
            try {
                if (prisma && typeof (prisma as any).sellerZona !== 'undefined') {
                    // Usar modelo Prisma
                    const sellerZona = await (prisma as any).sellerZona.findFirst({
                        where: {
                            zonaId: zonaId,
                            seller: {
                                active: true
                            }
                        },
                        include: {
                            seller: true
                        }
                    });

                    if (sellerZona && sellerZona.seller) {
                        return sellerZona.seller.id;
                    }
                } else {
                    // Fallback: usar SQL direto
                    const result = await prisma.$queryRaw<Array<{
                        seller_id: string;
                    }>>`
                        SELECT sz.seller_id 
                        FROM seller_zonas sz
                        INNER JOIN sellers s ON s.id = sz.seller_id
                        WHERE sz.zona_id = ${zonaId} AND s.active = true
                        LIMIT 1
                    `;
                    
                    if (result && result.length > 0) {
                        return result[0].seller_id;
                    }
                }

                return null;
            } catch (error: any) {
                // Se a tabela não existir, retornar null silenciosamente
                if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
                    console.warn('Tabela seller_zonas não existe ainda. Execute: npx prisma db push');
                    return null;
                }
                console.error('Erro ao buscar executivo por zona:', error);
                return null;
            }
        };

        // Função helper para buscar valor de coluna com múltiplas variações
        const getColumnValue = (row: any, possibleNames: string[]): any => {
            // Primeiro, tentar busca exata
            for (const name of possibleNames) {
                if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                    return row[name];
                }
            }

            // Depois, tentar busca case-insensitive e com trim
            const rowKeys = Object.keys(row);
            for (const possibleName of possibleNames) {
                const found = rowKeys.find(key => {
                    const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
                    const normalizedName = possibleName.toLowerCase().trim().replace(/\s+/g, ' ');
                    return normalizedKey === normalizedName ||
                        normalizedKey.includes(normalizedName) ||
                        normalizedName.includes(normalizedKey);
                });
                if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
                    return row[found];
                }
            }

            return null;
        };

        // Processar cada arquivo
        for (const file of files) {
            try {
                const fileName = file.name.toLowerCase();
                const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
                const isText = fileName.endsWith('.txt') || fileName.endsWith('.csv');
                
                let rows: any[] = [];
                
                if (isExcel) {
                    // Processar arquivo Excel
                    const bytes = await file.arrayBuffer();
                    const buffer = Buffer.from(bytes);
                    const workbook = xlsx.read(buffer);
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    rows = xlsx.utils.sheet_to_json<any>(sheet);
                } else if (isText) {
                    // Processar arquivo de texto
                    rows = await parseTextFile(file);
                } else {
                    return {
                        success: false,
                        message: `Formato de arquivo não suportado: ${file.name}. Use .xlsx, .xls, .txt ou .csv`
                    };
                }

                let fileImported = 0;
                let fileSkipped = 0;
                let fileErrors = 0;

                // Processar cada linha do arquivo
                for (const row of rows) {
                    try {
                        // Extrair TODOS os comentários (busca dinâmica em todas as colunas)
                        const comments: string[] = [];
                        
                        // Se o arquivo de texto já trouxe comentários no formato array
                        if (Array.isArray(row.comments)) {
                            comments.push(...row.comments.filter((c: any) => c && c.toString().trim()));
                        }

                        // Método 1: Buscar colunas "Comentário X" (até 200 para garantir)
                        for (let i = 1; i <= 200; i++) {
                            const comment = row[`Comentário ${i}`];
                            if (comment && comment.toString().trim()) {
                                comments.push(comment.toString().trim());
                            }
                        }

                        // Método 2: Buscar outras variações de nome de coluna
                        const commentVariations = [
                            'Comentarios', 'ComentÃ¡rios', 'Comentario', 'ComentÃ¡rio',
                            'Comentario 1', 'ComentÃ¡rios 1', 'Comentario1', 'ComentÃ¡rios1'
                        ];

                        for (const variation of commentVariations) {
                            const comment = row[variation];
                            if (comment && comment.toString().trim() && !comments.includes(comment.toString().trim())) {
                                comments.push(comment.toString().trim());
                            }
                        }

                        // Método 3: Buscar em todas as colunas que contenham "coment" no nome
                        for (const key in row) {
                            if (key.toLowerCase().includes('coment') && row[key]) {
                                const comment = row[key].toString().trim();
                                if (comment && !comments.includes(comment)) {
                                    comments.push(comment);
                                }
                            }
                        }

                        // Buscar valores com múltiplas variações de nomes de colunas
                        const name = getColumnValue(row, ['Nome', 'nome', 'NOME', 'Restaurante', 'restaurante']) || 'Unknown';
                        const city = getColumnValue(row, ['Cidade', 'cidade', 'CIDADE', 'City', 'city']) || '';

                        // Verificar se jÃ¡ existe
                        const existing = await prisma.restaurant.findFirst({
                            where: {
                                name: name,
                                address: {
                                    path: ['city'],
                                    equals: city
                                }
                            }
                        });

                        if (existing) {
                            fileSkipped++;
                            continue;
                        }

                        const neighborhood = getColumnValue(row, ['Bairro', 'Neighborhood', 'neighborhood', 'Distrito']) || '';
                        let cep = getColumnValue(row, ['CEP', 'Zip Code', 'zipCode', 'Código Postal', 'Cep', 'cep', 'CEP/Código Postal', 'Postal Code', 'postalCode']) || '';

                        // Limpar e normalizar CEP antes de usar
                        if (cep) {
                            // Remover caracteres não numéricos, mas manter o formato se já estiver correto
                            const cleanedCep = cep.replace(/[^0-9]/g, '');
                            if (cleanedCep.length === 8) {
                                // Formatar como 12345-678 se não tiver hífen
                                if (!cep.includes('-')) {
                                    cep = `${cleanedCep.substring(0, 5)}-${cleanedCep.substring(5)}`;
                                } else {
                                    cep = cleanedCep.substring(0, 5) + '-' + cleanedCep.substring(5);
                                }
                            } else if (cleanedCep.length > 0) {
                                // Se tiver mais ou menos dígitos, usar apenas os 8 primeiros ou preencher com zeros
                                if (cleanedCep.length > 8) {
                                    cep = cleanedCep.substring(0, 5) + '-' + cleanedCep.substring(5, 8);
                                } else {
                                    // Preencher com zeros à esquerda se tiver menos de 8 dígitos
                                    const padded = cleanedCep.padStart(8, '0');
                                    cep = padded.substring(0, 5) + '-' + padded.substring(5);
                                }
                            } else {
                                cep = '';
                            }
                        }

                        // Buscar zona por CEP
                        let zonaId: string | null = null;
                        let sellerId: string | null = null;

                        if (cep && cep.replace(/[^0-9]/g, '').length === 8) {
                            zonaId = await findZonaByCep(cep);
                            if (zonaId) {
                                sellerId = await findSellerByZona(zonaId);
                            }
                        }

                        // Criar restaurante com zona e executivo já atribuídos
                        await prisma.restaurant.create({
                            data: {
                                name: name,
                                rating: (() => {
                                    const val = getColumnValue(row, ['Avaliação', 'AvaliaÃ§Ã£o', 'avaliação', 'AVALIAÇÃO', 'Nota', 'Rating', 'rating']);
                                    return val ? parseFloat(String(val).replace(',', '.')) : 0;
                                })(),
                                reviewCount: (() => {
                                    const val = getColumnValue(row, ['Nº Avaliações', 'NÂº AvaliaÃ§Ãµes', 'N° Avaliações', 'Total Avaliações', 'Total de Avaliações', 'Review Count', 'reviewCount']);
                                    return val ? parseInt(String(val).replace(/[^\d]/g, '')) : 0;
                                })(),
                                totalComments: (() => {
                                    const val = getColumnValue(row, ['Total Comentários', 'Total ComentÃ¡rios', 'Qtd Comentários', 'Quantidade de Comentários', 'Nº Comentários']);
                                    return val ? parseInt(String(val).replace(/[^\d]/g, '')) : comments.length;
                                })(),
                                projectedDeliveries: (() => {
                                    const val = getColumnValue(row, ['Projeção Entregas/Mês', 'ProjeÃ§Ã£o Entregas/MÃªs', 'Entregas/Mês', 'Entregas por Mês', 'Projected Deliveries']);
                                    return val ? parseInt(String(val).replace(/[^\d]/g, '')) : 0;
                                })(),
                                salesPotential: getColumnValue(row, ['Potencial Vendas', 'Potencial', 'potencial', 'Sales Potential']) || 'N/A',
                                address: {
                                    street: getColumnValue(row, ['Endereço (Rua)', 'EndereÃ§o (Rua)', 'Rua', 'Endereço', 'Street']) || '',
                                    neighborhood: neighborhood,
                                    city: city,
                                    state: getColumnValue(row, ['Estado', 'State', 'state', 'UF']) || '',
                                    zip: cep,
                                },
                                zonaId: zonaId || undefined,
                                sellerId: sellerId || undefined,
                                assignedAt: sellerId ? new Date() : undefined,
                                lastCollectionDate: (() => {
                                    const val = getColumnValue(row, ['Data Coleta', 'Data de Coleta', 'Collection Date', 'Última Coleta']);
                                    return val ? (val instanceof Date ? val : new Date(String(val))) : null;
                                })(),
                                status: (() => {
                                    const potencial = getColumnValue(row, ['Potencial Vendas', 'Potencial']) || '';
                                    return String(potencial).toUpperCase().includes('ALTISSIMO') || String(potencial).toUpperCase().includes('ALTÍSSIMO') ? 'Qualificado' : 'A Analisar';
                                })(),
                                sourceFile: file.name,
                                comments: {
                                    create: comments.map(content => ({ content }))
                                }
                            }
                        });

                        fileImported++;
                    } catch (error: any) {
                        fileErrors++;
                        console.error(`Erro ao importar linha do arquivo ${file.name}:`, error);
                    }
                }

                // Acumular resultados do arquivo
                totalImported += fileImported;
                totalSkipped += fileSkipped;
                totalErrors += fileErrors;
                processedFiles++;

                console.log(`Arquivo ${file.name} processado: ${fileImported} importados, ${fileSkipped} ignorados, ${fileErrors} erros`);
            } catch (error: any) {
                totalErrors++;
                console.error(`Erro ao processar arquivo ${file.name}:`, error);
            }
        }

        revalidatePath('/clients');
        revalidatePath('/pipeline');
        revalidatePath('/');

        // Criar notificação de importação concluída
        if (totalImported > 0) {
            await createSystemNotification(
                'success',
                '📥 Importação Concluída',
                `${totalImported} restaurantes importados de ${processedFiles} planilha(s).`,
                { imported: totalImported, files: processedFiles }
            );
        }

        return {
            success: true,
            message: `Importação concluída! ${processedFiles} planilha(s) processada(s). ${totalImported} restaurantes importados.`,
            imported: totalImported,
            skipped: totalSkipped,
            errors: totalErrors,
            processed: processedFiles
        };

    } catch (error: any) {
        return {
            success: false,
            message: `Erro ao processar arquivo: ${error.message}`
        };
    }
}
// Action para limpar dados mockados
export async function clearMockData() {
    'use server';

    const { prisma } = await import('@/lib/db');

    try {
        let removed = 0;

        // Identificar restaurantes mockados
        const mockPatterns = ['Unknown', 'Test', 'Mock', 'Exemplo', 'Sample', 'Demo'];
        const allRestaurants = await prisma.restaurant.findMany();

        const mockRestaurants = allRestaurants.filter(r =>
            mockPatterns.some(pattern => r.name.toLowerCase().includes(pattern.toLowerCase()))
        );

        if (mockRestaurants.length > 0) {
            // Deletar dados relacionados
            for (const restaurant of mockRestaurants) {
                await prisma.comment.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.analysis.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.note.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.followUp.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.activityLog.deleteMany({ where: { restaurantId: restaurant.id } });
            }

            await prisma.restaurant.deleteMany({
                where: { id: { in: mockRestaurants.map(r => r.id) } }
            });

            removed = mockRestaurants.length;
        }

    revalidatePath('/');
    revalidatePath('/clients');
    revalidatePath('/pipeline');

        return `✅ Limpeza concluída! ${removed} restaurantes mockados removidos.`;

    } catch (error: any) {
        return `❌ Erro: ${error.message}`;
    }
}

// Action para limpar a última importação
export async function clearLastImport(hours: number = 24) {
    'use server';

    const { prisma } = await import('@/lib/db');

    try {
        // Calcular data limite (últimas X horas)
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hours);

        // Buscar restaurantes importados recentemente
        const recentRestaurants = await prisma.restaurant.findMany({
            where: {
                createdAt: {
                    gte: cutoffDate
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (recentRestaurants.length === 0) {
            return {
                success: true,
                message: `Nenhum restaurante encontrado importado nas últimas ${hours} horas.`,
                removed: 0
            };
        }

        let removed = 0;
        const restaurantIds = recentRestaurants.map(r => r.id);

        // Deletar dados relacionados
        await prisma.comment.deleteMany({ 
            where: { restaurantId: { in: restaurantIds } } 
        });
        await prisma.analysis.deleteMany({ 
            where: { restaurantId: { in: restaurantIds } } 
        });
        await prisma.note.deleteMany({ 
            where: { restaurantId: { in: restaurantIds } } 
        });
        await prisma.followUp.deleteMany({ 
            where: { restaurantId: { in: restaurantIds } } 
        });
        await prisma.activityLog.deleteMany({ 
            where: { restaurantId: { in: restaurantIds } } 
        });
        
        // Deletar visitas relacionadas
        try {
            await prisma.visit.deleteMany({ 
                where: { restaurantId: { in: restaurantIds } } 
            });
        } catch (e) {
            // Tabela visits pode não existir
        }

        // Deletar restaurantes
        await prisma.restaurant.deleteMany({
            where: { id: { in: restaurantIds } }
        });

        removed = recentRestaurants.length;

        // Criar notificação
        await createSystemNotification(
            'info',
            '🗑️ Importação Removida',
            `${removed} restaurantes da última importação foram removidos.`,
            { removed, hours }
        );

        revalidatePath('/');
        revalidatePath('/clients');
    revalidatePath('/pipeline');

        return {
            success: true,
            message: `✅ Limpeza concluída! ${removed} restaurantes da última importação foram removidos.`,
            removed
        };

    } catch (error: any) {
        console.error('Erro ao limpar última importação:', error);
        return {
            success: false,
            message: `❌ Erro: ${error.message}`,
            removed: 0
        };
    }
}

// Visitas
export async function createVisit(data: {
    restaurantId: string;
    sellerId: string;
    visitDate: string;
    feedback: string;
    outcome: 'positive' | 'neutral' | 'negative' | 'scheduled';
    nextVisitDate?: string;
    createFollowUp: boolean;
}) {
    'use server';

    const { prisma } = await import('@/lib/db');
    const { saveFollowUp } = await import('@/lib/db-data');

    try {
        // Criar a visita
        const visit = await prisma.visit.create({
            data: {
                restaurantId: data.restaurantId,
                sellerId: data.sellerId,
                visitDate: new Date(data.visitDate),
                feedback: data.feedback,
                outcome: data.outcome,
                nextVisitDate: data.nextVisitDate ? new Date(data.nextVisitDate) : null,
            }
        });

        // Criar follow-up se solicitado
        if (data.createFollowUp) {
            let followUpType: 'email' | 'call' | 'meeting' = 'call';
            let scheduledDate = new Date();

            if (data.nextVisitDate) {
                scheduledDate = new Date(data.nextVisitDate);
                followUpType = 'meeting';
            } else {
                // Agendar follow-up baseado no outcome
                scheduledDate = new Date();
                if (data.outcome === 'positive') {
                    scheduledDate.setDate(scheduledDate.getDate() + 3); // 3 dias
                    followUpType = 'email';
                } else if (data.outcome === 'scheduled') {
                    scheduledDate.setDate(scheduledDate.getDate() + 7); // 7 dias
                    followUpType = 'meeting';
                } else {
                    scheduledDate.setDate(scheduledDate.getDate() + 14); // 14 dias
                    followUpType = 'call';
                }
            }

            const followUp = await prisma.followUp.create({
                data: {
                    restaurantId: data.restaurantId,
                    type: followUpType,
                    scheduledDate: scheduledDate,
                    notes: `Follow-up automático após visita. Resultado: ${data.outcome}. ${data.feedback}`,
                    completed: false,
                }
            });

            // Atualizar visita com followUpId
            await prisma.visit.update({
                where: { id: visit.id },
                data: { followUpId: followUp.id }
            });
        }

        // Criar log de atividade
        await prisma.activityLog.create({
            data: {
                type: 'visit',
                title: 'Visita registrada',
                description: `Visita realizada com resultado: ${data.outcome}`,
                restaurantId: data.restaurantId,
                metadata: {
                    visitId: visit.id,
                    outcome: data.outcome,
                    sellerId: data.sellerId
                }
            }
        });

        revalidatePath(`/restaurant/${data.restaurantId}`);
        revalidatePath('/agenda');

        return { success: true, visitId: visit.id };
    } catch (error: any) {
        console.error('Erro ao criar visita:', error);
        throw new Error(`Erro ao criar visita: ${error.message}`);
    }
}

export async function getVisits(restaurantId?: string, sellerId?: string) {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        // Verificar se a tabela existe tentando uma query simples
        try {
            await prisma.$queryRaw`SELECT 1 FROM visits LIMIT 1`;
        } catch (error: any) {
            // Tabela não existe ainda, retornar array vazio
            console.log('Tabela visits ainda não existe no banco. Execute o SQL create-visits-table.sql');
            return [];
        }

        const visits = await prisma.visit.findMany({
            where: {
                ...(restaurantId && { restaurantId }),
                ...(sellerId && { sellerId }),
            },
            include: {
                restaurant: true,
                seller: true,
            },
            orderBy: { visitDate: 'desc' }
        });

        return visits.map(v => ({
            id: v.id,
            restaurantId: v.restaurantId,
            sellerId: v.sellerId,
            visitDate: v.visitDate.toISOString(),
            feedback: v.feedback || undefined,
            outcome: v.outcome as any,
            nextVisitDate: v.nextVisitDate?.toISOString(),
            followUpId: v.followUpId || undefined,
            createdAt: v.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: v.updatedAt?.toISOString() || new Date().toISOString(),
            restaurantName: v.restaurant.name,
            sellerName: v.seller.name,
        }));
    } catch (error: any) {
        console.error('Erro ao buscar visitas:', error);
        // Retornar array vazio em caso de erro
        return [];
    }
}

// Função para garantir que a coluna zona_id existe na tabela restaurants
async function ensureZonaIdColumnExists(prisma: any) {
    try {
        // Verificar se a coluna existe
        const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'restaurants' AND column_name = 'zona_id'
        `;
        
        if (result.length === 0) {
            // Coluna não existe, criar
            console.log('Criando coluna zona_id na tabela restaurants...');
            
            // Primeiro, criar a coluna
            await prisma.$executeRaw`
                ALTER TABLE restaurants 
                ADD COLUMN IF NOT EXISTS zona_id UUID
            `;
            
            // Verificar se a constraint já existe antes de criar
            try {
                const constraintCheck = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
                    SELECT constraint_name 
                    FROM information_schema.table_constraints 
                    WHERE table_name = 'restaurants' 
                    AND constraint_name = 'fk_restaurants_zona_id'
                `;
                
                if (constraintCheck.length === 0) {
                    // Tentar criar a foreign key (pode falhar se zonas_cep não existir)
                    try {
                        await prisma.$executeRaw`
                            ALTER TABLE restaurants 
                            ADD CONSTRAINT fk_restaurants_zona_id 
                            FOREIGN KEY (zona_id) REFERENCES zonas_cep(id) ON DELETE SET NULL
                        `;
                    } catch (fkError: any) {
                        console.warn('Não foi possível criar foreign key (zonas_cep pode não existir ainda):', fkError.message);
                    }
                }
            } catch (checkError: any) {
                console.warn('Erro ao verificar constraint:', checkError.message);
            }
            
            // Criar índice se não existir
            await prisma.$executeRaw`
                CREATE INDEX IF NOT EXISTS idx_restaurants_zona_id ON restaurants(zona_id)
            `;
            
            console.log('Coluna zona_id criada com sucesso!');
        }
    } catch (error: any) {
        // Se a tabela zonas_cep não existir, criar sem foreign key primeiro
        if (error.message?.includes('zonas_cep') || error.code === '42P01') {
            console.warn('Tabela zonas_cep não existe ainda, criando coluna sem foreign key...');
            try {
                await prisma.$executeRaw`
                    ALTER TABLE restaurants 
                    ADD COLUMN IF NOT EXISTS zona_id UUID
                `;
                await prisma.$executeRaw`
                    CREATE INDEX IF NOT EXISTS idx_restaurants_zona_id ON restaurants(zona_id)
                `;
            } catch (e: any) {
                console.error('Erro ao criar coluna zona_id:', e.message);
            }
        } else {
            console.error('Erro ao verificar/criar coluna zona_id:', error.message);
        }
    }
}

// Função para alocar restaurantes existentes às suas zonas baseado no CEP
export async function allocateRestaurantsToZones() {
    'use server';
    
    try {
        console.log('\n\n🚀 ============================================');
        console.log('🚀 INICIANDO ALOCAÇÃO DE RESTAURANTES POR CEP');
        console.log('🚀 ============================================\n');
        
        const { prisma } = await import('@/lib/db');
        
        // Garantir que a coluna zona_id existe
        await ensureZonaIdColumnExists(prisma);
        
        // Limpar CEP
        const cleanCep = (cep: string): string => {
            return cep.replace(/[^0-9]/g, '');
        };
        
        // Função para encontrar zona por CEP (local, não importada)
        const findZonaByCep = async (cep: string): Promise<string | null> => {
            try {
                console.log(`\n🔎 ===== BUSCANDO ZONA PARA CEP: ${cep} =====`);
                
                // Limpar e validar CEP
                const cleanedCep = cleanCep(cep);
                if (cleanedCep.length !== 8) {
                    console.warn(`⚠️ CEP inválido (tamanho incorreto): ${cep} -> ${cleanedCep} (${cleanedCep.length} dígitos)`);
                    return null;
                }

                // Validar se é um número válido
                const cepNum = parseInt(cleanedCep, 10);
                if (isNaN(cepNum) || cepNum <= 0) {
                    console.warn(`⚠️ CEP inválido (não é número válido): ${cep} -> ${cleanedCep}`);
                    return null;
                }
                
                console.log(`   CEP limpo: ${cleanedCep}, número: ${cepNum}`);

                // Garantir que a tabela existe
                try {
                    await prisma.$queryRaw`SELECT 1 FROM zonas_cep LIMIT 1`;
                } catch (e) {
                    console.warn('⚠️ Tabela zonas_cep não existe');
                    return null;
                }

                // Buscar zonas (usar modelo se disponível, senão SQL direto)
                let zonas: any[] = [];
                
                if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                    zonas = await (prisma as any).zonaCep.findMany({
                        where: {
                            ativo: true
                        }
                    });
                } else {
                    // Fallback: usar SQL direto
                    const result = await prisma.$queryRaw<Array<{
                        id: string;
                        zona_nome: string;
                        cep_inicial: string;
                        cep_final: string;
                        ativo: boolean;
                    }>>`SELECT * FROM zonas_cep WHERE ativo = true`;
                    zonas = result.map(z => ({
                        id: z.id,
                        zonaNome: z.zona_nome,
                        cepInicial: z.cep_inicial,
                        cepFinal: z.cep_final,
                        ativo: z.ativo
                    }));
                }

                if (zonas.length === 0) {
                    console.warn('⚠️ Nenhuma zona ativa encontrada');
                    return null;
                }

                console.log(`   Total de zonas ativas encontradas: ${zonas.length}`);
                
                // Log das zonas encontradas para debug
                console.log(`\n📋 ZONAS ENCONTRADAS (${zonas.length}):`);
                zonas.forEach((z: any) => {
                    const nome = z.zonaNome || z.zona_nome;
                    const cepIni = z.cepInicial || z.cep_inicial;
                    const cepFim = z.cepFinal || z.cep_final;
                    console.log(`   - ${nome}: ${cepIni} a ${cepFim}`);
                });
                
                // Buscar zona que contém o CEP
                for (const zona of zonas) {
                    const zonaNome = (zona as any).zonaNome || (zona as any).zona_nome;
                    console.log(`\n   --- Verificando zona: ${zonaNome} ---`);
                    
                    const cepInicial = (zona as any).cepInicial || (zona as any).cep_inicial;
                    const cepFinal = (zona as any).cepFinal || (zona as any).cep_final;
                    
                    if (!cepInicial || !cepFinal) {
                        console.warn(`   ⚠️ Zona ${zonaNome} sem CEP inicial ou final`);
                        continue;
                    }
                    
                    const cepInicialCleaned = cleanCep(String(cepInicial));
                    const cepFinalCleaned = cleanCep(String(cepFinal));
                    const zonaInicio = parseInt(cepInicialCleaned, 10);
                    const zonaFim = parseInt(cepFinalCleaned, 10);
                    
                    console.log(`   CEP inicial: ${cepInicial} -> limpo: ${cepInicialCleaned} -> número: ${zonaInicio}`);
                    console.log(`   CEP final: ${cepFinal} -> limpo: ${cepFinalCleaned} -> número: ${zonaFim}`);
                    
                    // Validar se os CEPs da zona são válidos
                    if (isNaN(zonaInicio) || isNaN(zonaFim) || zonaInicio <= 0 || zonaFim <= 0) {
                        console.warn(`   ⚠️ Zona ${zonaNome} com CEPs inválidos: ${cepInicial} (${cepInicialCleaned} -> ${zonaInicio}) - ${cepFinal} (${cepFinalCleaned} -> ${zonaFim})`);
                        continue;
                    }
                    
                    // Verificar se o CEP está dentro do range
                    const isInRange = cepNum >= zonaInicio && cepNum <= zonaFim;
                    console.log(`   Comparação: ${cepNum} >= ${zonaInicio} && ${cepNum} <= ${zonaFim} = ${isInRange ? 'SIM ✅' : 'NÃO ❌'}`);
                    
                    if (isInRange) {
                        console.log(`   ✅ CEP ${cep} (${cepNum}) encontrado na zona ${zonaNome} (${cepInicial} - ${cepFinal})`);
                        return (zona as any).id;
                    }
                }

                console.warn(`\n❌ Nenhuma zona encontrada para CEP ${cep} (${cepNum}). Verificadas ${zonas.length} zonas ativas.`);
                return null;
            } catch (error) {
                console.error('❌ Erro ao buscar zona por CEP:', error);
                return null;
            }
        };
        
        // Buscar todos os restaurantes (incluindo os que já têm zona para revalidar)
        // Usar SQL direto para evitar problemas com Prisma Client e campos não reconhecidos
        let restaurants: Array<{ id: string; name: string; address: any; zonaId: string | null }> = [];
        
        try {
            // Verificar se a coluna existe antes de buscar
            const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants' AND column_name = 'zona_id'
            `;
            
            if (columnCheck.length > 0) {
                // Coluna existe, usar SQL direto
                const result = await prisma.$queryRaw<Array<{
                    id: string;
                    name: string;
                    address: any;
                    zona_id: string | null;
                }>>`
                    SELECT id, name, address, zona_id
                    FROM restaurants
                `;
                restaurants = result.map(r => ({
                    id: r.id,
                    name: r.name,
                    address: typeof r.address === 'string' ? JSON.parse(r.address) : r.address,
                    zonaId: r.zona_id
                }));
            } else {
                // Coluna não existe ainda, buscar sem ela e adicionar null
                const result = await prisma.$queryRaw<Array<{
                    id: string;
                    name: string;
                    address: any;
                }>>`
                    SELECT id, name, address
                    FROM restaurants
                `;
                restaurants = result.map(r => ({
                    id: r.id,
                    name: r.name,
                    address: typeof r.address === 'string' ? JSON.parse(r.address) : r.address,
                    zonaId: null
                }));
            }
        } catch (sqlError: any) {
            // Se SQL direto falhar, tentar Prisma como fallback
            console.warn('Erro ao buscar restaurantes com SQL direto, tentando Prisma:', sqlError.message);
            try {
                const prismaResult = await prisma.restaurant.findMany({
                    select: {
                        id: true,
                        name: true,
                        address: true,
                    }
                });
                
                restaurants = prismaResult.map(r => ({
                    id: r.id,
                    name: r.name,
                    address: r.address as any,
                    zonaId: null // Inicializar como null se não conseguir buscar
                }));
            } catch (prismaError: any) {
                console.error('Erro ao buscar restaurantes:', prismaError);
                throw new Error(`Não foi possível buscar restaurantes: ${prismaError.message}`);
            }
        }

        let allocated = 0;
        let updated = 0;
        let errors = 0;
        const unallocated: string[] = [];

        for (const restaurant of restaurants) {
            try {
                const address = restaurant.address as any;
                
                // Tentar vários formatos de CEP - MELHORADO
                let cep: string | null = null;
                
                if (typeof address === 'string') {
                    try {
                        const parsed = JSON.parse(address);
                        cep = parsed?.zip || parsed?.postalCode || parsed?.cep || parsed?.zipCode || parsed?.postal_code || parsed?.CEP;
                    } catch {
                        // Se não for JSON, tentar extrair CEP da string usando regex mais robusto
                        const cepMatch = address.match(/\d{5}-?\d{3}/);
                        if (cepMatch) {
                            cep = cepMatch[0];
                        } else {
                            // Tentar extrair qualquer sequência de 8 dígitos
                            const digitsOnly = address.replace(/[^0-9]/g, '');
                            if (digitsOnly.length >= 8) {
                                cep = digitsOnly.substring(0, 8);
                            }
                        }
                    }
                } else if (address && typeof address === 'object') {
                    // O formato padrão do sistema usa 'zip'
                    // Tentar todas as variações possíveis
                    cep = address?.zip || 
                          address?.postalCode || 
                          address?.cep || 
                          address?.zipCode || 
                          address?.postal_code ||
                          address?.CEP ||
                          address?.Zip ||
                          address?.ZIP ||
                          address?.Cep ||
                          address?.PostalCode ||
                          address?.postal_code;
                    
                    // Se ainda não encontrou, tentar buscar em sub-objetos
                    if (!cep) {
                        if (address?.address && typeof address.address === 'object') {
                            cep = address.address.zip || address.address.cep || address.address.zipCode;
                        }
                        if (!cep && address?.location && typeof address.location === 'object') {
                            cep = address.location.zip || address.location.cep || address.location.zipCode;
                        }
                    }
                    
                    // Log para debug se não encontrou CEP
                    if (!cep) {
                        console.log(`⚠️ CEP não encontrado no objeto address para restaurante ${restaurant.id}. Chaves disponíveis:`, Object.keys(address || {}));
                        console.log(`   Address completo:`, JSON.stringify(address, null, 2));
                    }
                }
                
                // Se ainda não encontrou, tentar converter o objeto inteiro para string e buscar
                if (!cep && address && typeof address === 'object') {
                    const addressStr = JSON.stringify(address);
                    const cepMatch = addressStr.match(/\d{5}-?\d{3}/);
                    if (cepMatch) {
                        cep = cepMatch[0];
                    } else {
                        const digitsOnly = addressStr.replace(/[^0-9]/g, '');
                        if (digitsOnly.length >= 8) {
                            // Tentar encontrar CEP válido (começando com 0-9)
                            for (let i = 0; i <= digitsOnly.length - 8; i++) {
                                const candidate = digitsOnly.substring(i, i + 8);
                                if (candidate.startsWith('0') || candidate.startsWith('1') || candidate.startsWith('2')) {
                                    cep = candidate;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if (!cep || cep.trim() === '') {
                    console.log(`⚠️ Restaurante ${restaurant.id} sem CEP. Address:`, JSON.stringify(address));
                    unallocated.push(restaurant.id);
                    continue;
                }

                // Limpar e validar CEP - GARANTIR que seja string
                const cepStr = String(cep).trim();
                const cleanedCep = cleanCep(cepStr);
                
                if (cleanedCep.length !== 8) {
                    console.log(`⚠️ CEP inválido para restaurante ${restaurant.id}: ${cep} (limpo: ${cleanedCep}, tamanho: ${cleanedCep.length})`);
                    unallocated.push(restaurant.id);
                    continue;
                }

                // Validar se é um número válido
                const cepNum = parseInt(cleanedCep, 10);
                if (isNaN(cepNum) || cepNum <= 0) {
                    console.log(`⚠️ CEP não é número válido para restaurante ${restaurant.id}: ${cep} -> ${cleanedCep} -> ${cepNum}`);
                    unallocated.push(restaurant.id);
                    continue;
                }

                // Log detalhado do CEP encontrado para debug
                console.log(`\n🔍 ===== PROCESSANDO RESTAURANTE ${restaurant.id} =====`);
                console.log(`   Nome: ${restaurant.name || 'N/A'}`);
                console.log(`   CEP encontrado: "${cep}"`);
                console.log(`   CEP limpo: ${cleanedCep}`);
                console.log(`   CEP número: ${cepNum}`);
                console.log(`   Address completo:`, JSON.stringify(address, null, 2));
                
                // Encontrar zona pelo CEP
                console.log(`\n🔎 Chamando findZonaByCep para CEP: ${cep}`);
                const zonaId = await findZonaByCep(cep);
                console.log(`   Resultado findZonaByCep: ${zonaId || 'null (nenhuma zona encontrada)'}`);
                
                if (zonaId) {
                    console.log(`\n✅ ===== ZONA ENCONTRADA PARA RESTAURANTE ${restaurant.id} =====`);
                    console.log(`   Zona ID: ${zonaId}`);
                    const hadZona = restaurant.zonaId !== null;
                    
                    // Atualizar restaurante com a zona usando SQL direto
                    try {
                        await prisma.$executeRaw`
                            UPDATE restaurants 
                            SET zona_id = ${zonaId}::uuid
                            WHERE id = ${restaurant.id}::uuid
                        `;
                        console.log(`✅ Zona atualizada no banco para restaurante ${restaurant.id}`);
                    } catch (updateError: any) {
                        // Se falhar, tentar com Prisma
                        try {
                            await prisma.restaurant.update({
                                where: { id: restaurant.id },
                                data: { zonaId }
                            });
                            console.log(`✅ Zona atualizada via Prisma para restaurante ${restaurant.id}`);
                        } catch (prismaError: any) {
                            console.error(`❌ Erro ao atualizar zona do restaurante ${restaurant.id}:`, prismaError.message);
                            throw prismaError;
                        }
                    }
                    
                    // Se houver executivo para esta zona, atribuir também
                    const sellerId = await findSellerByZona(zonaId);
                    if (sellerId) {
                        try {
                            await prisma.$executeRaw`
                                UPDATE restaurants 
                                SET seller_id = ${sellerId}::uuid,
                                    assigned_at = NOW()
                                WHERE id = ${restaurant.id}::uuid
                            `;
                        } catch (updateError: any) {
                            // Se falhar, tentar com Prisma
                            try {
                                await prisma.restaurant.update({
                                    where: { id: restaurant.id },
                                    data: { 
                                        sellerId,
                                        assignedAt: new Date()
                                    }
                                });
                            } catch (prismaError: any) {
                                console.error(`Erro ao atualizar executivo do restaurante ${restaurant.id}:`, prismaError.message);
                            }
                        }
                    }
                    
                    if (hadZona) {
                        updated++;
                    } else {
                        allocated++;
                    }
                } else {
                    console.log(`\n❌ ===== NENHUMA ZONA ENCONTRADA PARA RESTAURANTE ${restaurant.id} =====`);
                    console.log(`   CEP: ${cep} (${cleanedCep}, número: ${cepNum})`);
                    console.log(`   Este restaurante será adicionado à lista de não alocados`);
                    unallocated.push(restaurant.id);
                }
            } catch (error: any) {
                console.error(`Erro ao alocar restaurante ${restaurant.id}:`, error.message);
                errors++;
            }
        }

        revalidatePath('/clients');
        revalidatePath('/carteira');
        revalidatePath('/pipeline');

        console.log('\n\n📊 ============================================');
        console.log('📊 RESUMO DA ALOCAÇÃO');
        console.log('📊 ============================================');
        console.log(`   ✅ Alocados: ${allocated}`);
        console.log(`   🔄 Atualizados: ${updated}`);
        console.log(`   ❌ Sem zona: ${unallocated.length}`);
        console.log(`   ⚠️ Erros: ${errors}`);
        console.log('📊 ============================================\n\n');

        return {
            success: true,
            allocated,
            updated,
            errors,
            unallocated: unallocated.length,
            message: `${allocated} restaurantes alocados, ${updated} atualizados, ${unallocated.length} sem zona correspondente, ${errors} erros`
        };
    } catch (error: any) {
        console.error('Erro ao alocar restaurantes:', error);
        return {
            success: false,
            allocated: 0,
            updated: 0,
            errors: 0,
            unallocated: 0,
            message: `Erro: ${error.message}`
        };
    }
}

// Função para sincronizar todos os restaurantes com executivos baseado nas zonas
export async function syncRestaurantsWithSellers() {
    'use server';
    
    try {
        const { prisma } = await import('@/lib/db');
        
        // Verificar se a coluna zona_id existe
        let columnExists = false;
        try {
            const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants' AND column_name = 'zona_id'
            `;
            columnExists = columnCheck.length > 0;
        } catch (e) {
            return {
                success: false,
                message: 'Coluna zona_id não existe. Execute a alocação de zonas primeiro.'
            };
        }

        if (!columnExists) {
            return {
                success: false,
                message: 'Coluna zona_id não existe. Execute a alocação de zonas primeiro.'
            };
        }

        // Buscar todos os executivos ativos com suas zonas
        let sellersWithZonas: Array<{ seller_id: string; zona_id: string }> = [];
        try {
            sellersWithZonas = await prisma.$queryRaw<Array<{ seller_id: string; zona_id: string }>>`
                SELECT sz.seller_id, sz.zona_id
                FROM seller_zonas sz
                INNER JOIN sellers s ON s.id = sz.seller_id
                WHERE s.active = true
            `;
        } catch (e: any) {
            return {
                success: false,
                message: `Erro ao buscar executivos: ${e.message}`
            };
        }

        if (sellersWithZonas.length === 0) {
            return {
                success: true,
                message: 'Nenhum executivo com zonas encontrado. Configure as zonas dos executivos primeiro.'
            };
        }

        // Criar mapa de zona -> executivo (pegar o primeiro executivo ativo para cada zona)
        const zonaToSellerMap = new Map<string, string>();
        sellersWithZonas.forEach(sz => {
            if (!zonaToSellerMap.has(sz.zona_id)) {
                zonaToSellerMap.set(sz.zona_id, sz.seller_id);
            }
        });

        // Buscar todos os restaurantes com zona mas sem executivo ou com executivo diferente
        let restaurantsToUpdate: Array<{ id: string; zona_id: string; seller_id: string | null }> = [];
        try {
            restaurantsToUpdate = await prisma.$queryRaw<Array<{ id: string; zona_id: string; seller_id: string | null }>>`
                SELECT id, zona_id, seller_id
                FROM restaurants
                WHERE zona_id IS NOT NULL
            `;
        } catch (e: any) {
            return {
                success: false,
                message: `Erro ao buscar restaurantes: ${e.message}`
            };
        }

        console.log(`\n📊 Total de restaurantes a verificar: ${restaurantsToUpdate.length}`);
        console.log(`📊 Total de zonas mapeadas: ${zonaToSellerMap.size}`);
        
        let updated = 0;
        let skipped = 0;
        let noZona = 0;

        // Atualizar cada restaurante
        for (const restaurant of restaurantsToUpdate) {
            const expectedSellerId = zonaToSellerMap.get(restaurant.zona_id);
            
            if (expectedSellerId) {
                // Se o restaurante não tem executivo ou tem um executivo diferente, atualizar
                if (!restaurant.seller_id || restaurant.seller_id !== expectedSellerId) {
                    try {
                        await prisma.$executeRaw`
                            UPDATE restaurants 
                            SET seller_id = ${expectedSellerId}::uuid,
                                assigned_at = NOW()
                            WHERE id = ${restaurant.id}::uuid
                        `;
                        updated++;
                        if (updated <= 10) { // Log apenas os primeiros 10 para não poluir
                            console.log(`   ✅ Restaurante ${restaurant.id} atualizado: zona ${restaurant.zona_id} -> executivo ${expectedSellerId}`);
                        }
                    } catch (e: any) {
                        console.warn(`   ❌ Erro ao atualizar restaurante ${restaurant.id}:`, e.message);
                    }
                } else {
                    skipped++;
                }
            } else {
                noZona++;
                if (noZona <= 5) { // Log apenas os primeiros 5
                    console.log(`   ⚠️ Restaurante ${restaurant.id} com zona ${restaurant.zona_id} sem executivo mapeado`);
                }
            }
        }
        
        console.log(`\n📊 Resumo:`);
        console.log(`   ✅ Atualizados: ${updated}`);
        console.log(`   ⏭️ Já corretos: ${skipped}`);
        console.log(`   ⚠️ Sem executivo mapeado: ${noZona}`);

        revalidatePath('/clients');
        revalidatePath('/carteira');
        revalidatePath('/pipeline');

        return {
            success: true,
            message: `${updated} restaurantes sincronizados com executivos, ${skipped} já estavam corretos`
        };
    } catch (error: any) {
        console.error('Erro ao sincronizar restaurantes:', error);
        return {
            success: false,
            message: `Erro: ${error.message}`
        };
    }
}

// Função auxiliar para encontrar executivo por zona (reutilizada)
async function findSellerByZona(zonaId: string): Promise<string | null> {
    const { prisma } = await import('@/lib/db');
    
    try {
        if (prisma && typeof (prisma as any).sellerZona !== 'undefined') {
            const sellerZona = await (prisma as any).sellerZona.findFirst({
                where: {
                    zonaId: zonaId,
                    seller: {
                        active: true
                    }
                },
                include: {
                    seller: true
                }
            });

            if (sellerZona && sellerZona.seller) {
                return sellerZona.seller.id;
            }
        } else {
            const result = await prisma.$queryRaw<Array<{
                seller_id: string;
            }>>`
                SELECT sz.seller_id 
                FROM seller_zonas sz
                INNER JOIN sellers s ON s.id = sz.seller_id
                WHERE sz.zona_id = ${zonaId} AND s.active = true
                LIMIT 1
            `;
            
            if (result && result.length > 0) {
                return result[0].seller_id;
            }
        }

        return null;
    } catch (error: any) {
        if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
            return null;
        }
        console.error('Erro ao buscar executivo por zona:', error);
        return null;
    }
}
