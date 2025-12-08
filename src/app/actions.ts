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

export async function createFollowUp(restaurantId: string, type: 'email' | 'call' | 'meeting' | 'whatsapp', scheduledDate: string, emailSubject?: string, emailBody?: string) {
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
                    } else if (field.includes('categoria') || field.includes('category')) {
                        restaurant['Categoria'] = value;
                        restaurant.category = value;
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
            
            const categoriaMatch = line.match(/(?:Categoria|Category)[:\s]+(.+)/i);
            if (categoriaMatch) {
                currentRestaurant['Categoria'] = categoriaMatch[1].trim();
                currentRestaurant.category = categoriaMatch[1].trim();
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

        // Buscar vendedores ativos (uma vez para todos os arquivos)
        const sellers = await prisma.seller.findMany({
            where: { active: true }
        });

        const findSellerForRegion = (city: string, neighborhood: string): string | null => {
            for (const seller of sellers) {
                // Check City Match
                if (city && city !== 'N/A') {
                    const regions = (seller.regions as string[]) || [];
                    if (regions.some(region =>
                        city.toLowerCase().includes(region.toLowerCase()) ||
                        region.toLowerCase().includes(city.toLowerCase())
                    )) {
                        return seller.id;
                    }
                }

                // Check Neighborhood Match
                if (neighborhood && neighborhood !== 'N/A') {
                    const sellerNeighborhoods = ((seller as any).neighborhoods as string[]) || [];
                    if (sellerNeighborhoods.some(nb =>
                        neighborhood.toLowerCase().includes(nb.toLowerCase()) ||
                        nb.toLowerCase().includes(neighborhood.toLowerCase())
                    )) {
                        return seller.id;
                    }
                }
            }
            return null;
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

                        // Encontrar vendedor
                        const sellerId = findSellerForRegion(city, neighborhood);

                        // Criar restaurante
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
                                category: getColumnValue(row, ['Categoria', 'Category', 'category', 'Tipo']) || 'N/A',
                                address: {
                                    street: getColumnValue(row, ['Endereço (Rua)', 'EndereÃ§o (Rua)', 'Rua', 'Endereço', 'Street']) || '',
                                    neighborhood: neighborhood,
                                    city: city,
                                    state: getColumnValue(row, ['Estado', 'State', 'state', 'UF']) || '',
                                    zip: getColumnValue(row, ['CEP', 'Zip Code', 'zipCode', 'Código Postal']) || '',
                                },
                                lastCollectionDate: (() => {
                                    const val = getColumnValue(row, ['Data Coleta', 'Data de Coleta', 'Collection Date', 'Última Coleta']);
                                    return val ? (val instanceof Date ? val : new Date(String(val))) : null;
                                })(),
                                status: (() => {
                                    const potencial = getColumnValue(row, ['Potencial Vendas', 'Potencial']) || '';
                                    return String(potencial).toUpperCase().includes('ALTISSIMO') || String(potencial).toUpperCase().includes('ALTÍSSIMO') ? 'Qualificado' : 'A Analisar';
                                })(),
                                sourceFile: file.name,
                                sellerId: sellerId,
                                assignedAt: sellerId ? new Date() : null,
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
            let followUpType: 'email' | 'call' | 'meeting' | 'whatsapp' = 'call';
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
