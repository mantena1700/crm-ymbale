'use server';

import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { saveFollowUp, getFollowUps, saveGoal, getGoals, getRestaurants, getAnalysis, saveStatus, saveAnalysis, saveNote } from '@/lib/db-data';
import { FollowUp, Restaurant, AnalysisResult, Note } from '@/lib/types';
import { generateEmailWithAI as generateEmail, generateStrategyWithAI as generateStrategy, generateFollowUpMessageWithAI as generateFollowUp } from '@/lib/openai-service';
import { analyzeRestaurant } from '@/lib/ai-service';

// Função para gerar o próximo código de cliente (começando em 10000)
async function getNextCodigoCliente(): Promise<number> {
    const { prisma } = await import('@/lib/db');

    // Buscar o maior código existente
    const maxCodigo = await prisma.restaurant.findFirst({
        where: {
            codigoCliente: {
                not: null
            }
        },
        orderBy: {
            codigoCliente: 'desc'
        },
        select: {
            codigoCliente: true
        }
    });

    // Se não há códigos, começar em 10000
    const startCode = 10000;
    const nextCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : startCode;

    // Garantir que seja pelo menos 10000
    return Math.max(nextCode, startCode);
}

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
        revalidatePath('/'); // Update dashboard stats
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

export async function deleteFollowUp(followUpId: string) {
    const { prisma } = await import('@/lib/db');
    try {
        await prisma.followUp.delete({
            where: { id: followUpId }
        });
        revalidatePath('/agenda');
        revalidatePath('/pipeline');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete follow-up:', error);
        return { success: false, error: 'Failed to delete' };
    }
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

                        // Atribuição geográfica automática usando Google Maps API (SEM ZONAS)
                        let sellerId: string | null = null;

                        try {
                            const { atribuirExecutivoAutomatico } = await import('@/lib/geographic-attribution');
                            const atribuicao = await atribuirExecutivoAutomatico({
                                name: name,
                                address: {
                                    street: getColumnValue(row, ['Endereço (Rua)', 'EndereÃ§o (Rua)', 'Rua', 'Endereço', 'Street']) || '',
                                    neighborhood: neighborhood,
                                    city: city,
                                    state: getColumnValue(row, ['Estado', 'State', 'state', 'UF']) || '',
                                    zip: cep,
                                },
                                cep: cep
                            });

                            if (atribuicao.sucesso && atribuicao.executivo_id) {
                                sellerId = atribuicao.executivo_id;
                                console.log(`   ✅ Atribuído geograficamente (Google Maps): ${atribuicao.executivo_nome} (${atribuicao.distancia_km}km)`);
                            } else {
                                console.warn(`   ⚠️ Não foi possível atribuir: ${atribuicao.erro || 'Erro desconhecido'}`);
                            }
                        } catch (geoError: any) {
                            console.warn(`   ⚠️ Erro na atribuição geográfica: ${geoError.message}`);
                        }

                        // Gerar código de cliente único
                        const codigoCliente = await getNextCodigoCliente();

                        // Extrair potencial de vendas para análise
                        const salesPotential = getColumnValue(row, ['Potencial Vendas', 'Potencial', 'potencial', 'Sales Potential']) || 'N/A';



                        // Criar restaurante com zona, executivo e análise já atribuídos
                        await prisma.restaurant.create({
                            data: {
                                name: name,
                                codigoCliente: codigoCliente,
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
                                salesPotential: salesPotential,
                                address: {
                                    street: getColumnValue(row, ['Endereço (Rua)', 'EndereÃ§o (Rua)', 'Rua', 'Endereço', 'Street']) || '',
                                    neighborhood: neighborhood,
                                    city: city,
                                    state: getColumnValue(row, ['Estado', 'State', 'state', 'UF']) || '',
                                    zip: cep,
                                },
                                sellerId: sellerId || undefined,
                                assignedAt: sellerId ? new Date() : undefined,
                                lastCollectionDate: (() => {
                                    const val = getColumnValue(row, ['Data Coleta', 'Data de Coleta', 'Collection Date', 'Última Coleta']);
                                    return val ? (val instanceof Date ? val : new Date(String(val))) : null;
                                })(),
                                status: (() => {
                                    return String(salesPotential).toUpperCase().includes('ALTISSIMO') || String(salesPotential).toUpperCase().includes('ALTÍSSIMO') ? 'Qualificado' : 'A Analisar';
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

// Função para sincronizar todos os restaurantes com executivos baseado nas áreas geográficas
export async function syncRestaurantsWithSellers() {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');
        const { atribuirExecutivoAutomatico } = await import('@/lib/geographic-attribution');

        // Buscar todos os executivos ativos com áreas de cobertura configuradas
        const sellers = await prisma.seller.findMany({
            where: {
                active: true,
                territorioAtivo: true,
                OR: [
                    { areasCobertura: { not: null } },
                    {
                        AND: [
                            { baseLatitude: { not: null } },
                            { baseLongitude: { not: null } },
                            { raioKm: { not: null } }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                name: true,
                areasCobertura: true,
                baseLatitude: true,
                baseLongitude: true,
                raioKm: true
            }
        });

        if (sellers.length === 0) {
            return {
                success: false,
                message: 'Nenhum executivo com áreas de cobertura configuradas encontrado. Configure as áreas no mapa primeiro.'
            };
        }

        console.log(`\n📊 Total de executivos com áreas configuradas: ${sellers.length}`);

        // Buscar todos os restaurantes
        const restaurants = await prisma.restaurant.findMany({
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                sellerId: true
            }
        });

        console.log(`📊 Total de restaurantes a verificar: ${restaurants.length}`);

        let updated = 0;
        let skipped = 0;
        let noCoordinates = 0;
        let noMatch = 0;

        // Atualizar cada restaurante usando atribuição geográfica
        for (const restaurant of restaurants) {
            try {
                // Se não tem coordenadas, tentar obter via geocoding
                if (!restaurant.latitude || !restaurant.longitude) {
                    const result = await atribuirExecutivoAutomatico({
                        id: restaurant.id,
                        name: restaurant.name,
                        address: restaurant.address
                    });

                    if (result.sucesso && result.executivo_id) {
                        // Verificar se precisa atualizar
                        if (restaurant.sellerId !== result.executivo_id) {
                            await prisma.restaurant.update({
                                where: { id: restaurant.id },
                                data: { sellerId: result.executivo_id }
                            });
                            updated++;
                            if (updated <= 10) {
                                console.log(`   ✅ ${restaurant.name}: atribuído a ${result.executivo_nome}`);
                            }
                        } else {
                            skipped++;
                        }
                    } else {
                        noCoordinates++;
                        if (noCoordinates <= 5) {
                            console.log(`   ⚠️ ${restaurant.name}: sem coordenadas e não foi possível geocodificar`);
                        }
                    }
                } else {
                    // Já tem coordenadas, verificar atribuição
                    const result = await atribuirExecutivoAutomatico({
                        id: restaurant.id,
                        name: restaurant.name,
                        latitude: restaurant.latitude,
                        longitude: restaurant.longitude
                    });

                    if (result.sucesso && result.executivo_id) {
                        // Verificar se precisa atualizar
                        if (restaurant.sellerId !== result.executivo_id) {
                            await prisma.restaurant.update({
                                where: { id: restaurant.id },
                                data: { sellerId: result.executivo_id }
                            });
                            updated++;
                            if (updated <= 10) {
                                console.log(`   ✅ ${restaurant.name}: atribuído a ${result.executivo_nome}`);
                            }
                        } else {
                            skipped++;
                        }
                    } else {
                        noMatch++;
                        if (noMatch <= 5) {
                            console.log(`   ⚠️ ${restaurant.name}: não está dentro de nenhuma área de cobertura`);
                        }
                    }
                }
            } catch (e: any) {
                console.error(`   ❌ Erro ao processar restaurante ${restaurant.id}:`, e.message);
            }
        }

        console.log(`\n📊 Resumo:`);
        console.log(`   ✅ Atualizados: ${updated}`);
        console.log(`   ⏭️ Já corretos: ${skipped}`);
        console.log(`   ⚠️ Sem coordenadas: ${noCoordinates}`);
        console.log(`   ⚠️ Fora de todas as áreas: ${noMatch}`);

        revalidatePath('/clients');
        revalidatePath('/carteira');
        revalidatePath('/pipeline');

        return {
            success: true,
            message: `${updated} restaurantes sincronizados com executivos, ${skipped} já estavam corretos. ${noMatch > 0 ? `${noMatch} restaurantes fora de todas as áreas.` : ''}`
        };
    } catch (error: any) {
        console.error('Erro ao sincronizar restaurantes:', error);
        return {
            success: false,
            message: `Erro: ${error.message}`
        };
    }
}

// Exportar restaurantes selecionados para Excel (mesmo formato da importação)
// Deletar múltiplos restaurantes permanentemente
export async function deleteRestaurants(restaurantIds: string[]) {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        if (!restaurantIds || restaurantIds.length === 0) {
            return {
                success: false,
                error: 'Nenhum restaurante selecionado para deletar'
            };
        }

        // Deletar dados relacionados primeiro
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

        // Deletar relacionamentos de campanhas
        try {
            await prisma.campaignRecipient.deleteMany({
                where: { restaurantId: { in: restaurantIds } }
            });
        } catch (e) {
            // Tabela pode não existir
        }

        // Deletar relacionamentos de workflows
        try {
            await prisma.workflowExecution.deleteMany({
                where: { restaurantId: { in: restaurantIds } }
            });
        } catch (e) {
            // Tabela pode não existir
        }

        // Deletar clientes fixos relacionados
        try {
            await prisma.fixedClient.deleteMany({
                where: { restaurantId: { in: restaurantIds } }
            });
        } catch (e) {
            // Tabela pode não existir
        }

        // Deletar restaurantes
        const result = await prisma.restaurant.deleteMany({
            where: { id: { in: restaurantIds } }
        });

        revalidatePath('/clients');
        revalidatePath('/pipeline');
        revalidatePath('/carteira');

        return {
            success: true,
            count: result.count,
            message: `${result.count} cliente(s) deletado(s) permanentemente`
        };
    } catch (error: any) {
        console.error('Erro ao deletar restaurantes:', error);
        return {
            success: false,
            error: error.message || 'Erro ao deletar restaurantes'
        };
    }
}

// Mover múltiplos restaurantes para "Descartado"
export async function discardRestaurants(restaurantIds: string[]) {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        if (!restaurantIds || restaurantIds.length === 0) {
            return {
                success: false,
                error: 'Nenhum restaurante selecionado para descartar'
            };
        }

        // Atualizar status para "Descartado"
        const result = await prisma.restaurant.updateMany({
            where: { id: { in: restaurantIds } },
            data: {
                status: 'Descartado',
                updatedAt: new Date()
            }
        });

        // Criar logs de atividade
        try {
            await prisma.activityLog.createMany({
                data: restaurantIds.map(restaurantId => ({
                    type: 'status_change',
                    title: 'Cliente Descartado',
                    description: 'Cliente movido para a área de descartados',
                    restaurantId
                }))
            });
        } catch (e) {
            // Log de atividade pode falhar, mas não é crítico
            console.warn('Erro ao criar logs de atividade:', e);
        }

        revalidatePath('/clients');
        revalidatePath('/pipeline');
        revalidatePath('/carteira');

        return {
            success: true,
            count: result.count,
            message: `${result.count} cliente(s) movido(s) para descartados`
        };
    } catch (error: any) {
        console.error('Erro ao descartar restaurantes:', error);
        return {
            success: false,
            error: error.message || 'Erro ao descartar restaurantes'
        };
    }
}

// Restaurar múltiplos restaurantes descartados (voltar para "A Analisar")
export async function restoreRestaurants(restaurantIds: string[]) {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        if (!restaurantIds || restaurantIds.length === 0) {
            return {
                success: false,
                error: 'Nenhum restaurante selecionado para restaurar'
            };
        }

        // Atualizar status para "A Analisar"
        const result = await prisma.restaurant.updateMany({
            where: { id: { in: restaurantIds } },
            data: {
                status: 'A Analisar',
                updatedAt: new Date()
            }
        });

        // Criar logs de atividade
        try {
            await prisma.activityLog.createMany({
                data: restaurantIds.map(restaurantId => ({
                    type: 'status_change',
                    title: 'Cliente Restaurado',
                    description: 'Cliente restaurado da área de descartados',
                    restaurantId
                }))
            });
        } catch (e) {
            // Log de atividade pode falhar, mas não é crítico
            console.warn('Erro ao criar logs de atividade:', e);
        }

        revalidatePath('/clients');
        revalidatePath('/pipeline');
        revalidatePath('/carteira');

        return {
            success: true,
            count: result.count,
            message: `${result.count} cliente(s) restaurado(s) com sucesso`
        };
    } catch (error: any) {
        console.error('Erro ao restaurar restaurantes:', error);
        return {
            success: false,
            error: error.message || 'Erro ao restaurar restaurantes'
        };
    }
}

export async function exportRestaurantsToExcel(restaurantIds: string[]) {
    'use server';

    try {
        const xlsx = await import('xlsx');
        const { prisma } = await import('@/lib/db');

        // Buscar restaurantes selecionados
        const restaurants = await prisma.restaurant.findMany({
            where: {
                id: { in: restaurantIds }
            },
            include: {
                seller: {
                    select: {
                        name: true
                    }
                },
                comments: {
                    select: {
                        content: true
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Preparar dados para Excel (mesmo formato da importação)
        const excelData = restaurants.map((r: any) => {
            const address = typeof r.address === 'string' ? JSON.parse(r.address) : r.address;

            // Preparar comentários (Comentário 1, Comentário 2, etc.)
            const commentObj: any = {};
            r.comments.forEach((comment: any, index: number) => {
                commentObj[`Comentário ${index + 1}`] = comment.content || '';
            });

            return {
                'Nome': r.name || '',
                'Endereço (Rua)': address?.street || address?.address || '',
                'Bairro': address?.neighborhood || address?.bairro || '',
                'Cidade': address?.city || address?.cidade || '',
                'Estado': address?.state || address?.estado || '',
                'CEP': address?.zip || address?.cep || address?.postal_code || '',
                'Avaliação': r.rating || 0,
                'Nº Avaliações': r.reviewCount || 0,
                'Total Comentários': r.totalComments || r.comments?.length || 0,
                'Projeção Entregas/Mês': r.projectedDeliveries || 0,
                'Potencial Vendas': r.salesPotential || 'N/A',
                'Categoria': r.category || 'N/A',
                'Status': r.status || 'A Analisar',
                'Executivo': r.seller?.name || 'Sem executivo',
                'Data Coleta': r.lastCollectionDate ? new Date(r.lastCollectionDate).toLocaleDateString('pt-BR') : '',
                ...commentObj
            };
        });

        // Criar workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelData);

        // Ajustar largura das colunas
        const colWidths = [
            { wch: 30 }, // Nome
            { wch: 40 }, // Endereço
            { wch: 20 }, // Bairro
            { wch: 20 }, // Cidade
            { wch: 10 }, // Estado
            { wch: 12 }, // CEP
            { wch: 12 }, // Avaliação
            { wch: 15 }, // Nº Avaliações
            { wch: 18 }, // Total Comentários
            { wch: 20 }, // Projeção Entregas
            { wch: 18 }, // Potencial Vendas
            { wch: 20 }, // Categoria
            { wch: 15 }, // Status
            { wch: 20 }, // Executivo
            { wch: 15 }, // Data Coleta
        ];
        // Adicionar largura para colunas de comentários (até 50 comentários)
        for (let i = 1; i <= 50; i++) {
            colWidths.push({ wch: 30 });
        }
        ws['!cols'] = colWidths;

        xlsx.utils.book_append_sheet(wb, ws, 'Clientes');

        // Converter para buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Converter para base64
        const base64 = Buffer.from(buffer).toString('base64');

        return {
            success: true,
            data: base64,
            filename: `Clientes_Exportados_${new Date().toISOString().split('T')[0]}.xlsx`,
            count: restaurants.length
        };
    } catch (error: any) {
        console.error('Erro ao exportar restaurantes:', error);
        return {
            success: false,
            error: error.message || 'Erro ao exportar restaurantes'
        };
    }
}

// Exportar restaurantes para formato Checkmob (template de cadastro)
export async function exportRestaurantsToCheckmob(restaurantIds: string[]) {
    'use server';

    try {
        const ExcelJS = await import('exceljs');
        const fs = await import('fs');
        const path = await import('path');
        const { prisma } = await import('@/lib/db');

        // Caminho do template original
        // Tentar múltiplos caminhos possíveis
        const possiblePaths = [
            // Caminho absoluto direto (mais confiável)
            'C:\\Users\\Bel\\Documents\\CRM_Ymbale\\Copy of Template - Cadastro Cliente(1).xlsx',
            // Pasta pai do projeto (process.cwd() retorna crm-ymbale, então .. volta para CRM_Ymbale)
            path.resolve(process.cwd(), '..', 'Copy of Template - Cadastro Cliente(1).xlsx'),
            // Raiz do projeto
            path.resolve(process.cwd(), 'Copy of Template - Cadastro Cliente(1).xlsx'),
            // Caminho usando path.join
            path.join('C:', 'Users', 'Bel', 'Documents', 'CRM_Ymbale', 'Copy of Template - Cadastro Cliente(1).xlsx'),
        ];

        let finalTemplatePath = '';
        let triedPaths: string[] = [];

        for (const templatePath of possiblePaths) {
            triedPaths.push(templatePath);
            try {
                const normalizedPath = path.resolve(templatePath);
                if (fs.existsSync(normalizedPath)) {
                    finalTemplatePath = normalizedPath;
                    console.log(`✅ Template encontrado em: ${normalizedPath}`);
                    break;
                }
            } catch (error: any) {
                // Continuar tentando outros caminhos
                console.log(`⚠️ Caminho não encontrado: ${templatePath}`);
                continue;
            }
        }

        // Verificar se o template existe
        if (!finalTemplatePath || !fs.existsSync(finalTemplatePath)) {
            const errorMsg = `Template não encontrado.\n\nCaminhos tentados:\n${triedPaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nVerifique se o arquivo "Copy of Template - Cadastro Cliente(1).xlsx" está em:\nC:\\Users\\Bel\\Documents\\CRM_Ymbale\\`;
            console.error('❌ Erro:', errorMsg);
            throw new Error(errorMsg);
        }

        // Verificar se o campo codigo_cliente existe no banco
        let codigoClienteFieldExists = false;
        try {
            // Tentar uma query simples para verificar se o campo existe
            await prisma.$queryRaw`SELECT codigo_cliente FROM restaurants LIMIT 1`;
            codigoClienteFieldExists = true;
            console.log('✅ Campo codigo_cliente existe no banco');
        } catch (error: any) {
            if (error.message?.includes('codigo_cliente') ||
                error.message?.includes('does not exist') ||
                error.message?.includes('Unknown column') ||
                error.message?.includes('column "codigo_cliente" does not exist')) {
                console.warn('⚠️ Campo codigo_cliente não existe no banco ainda. Pulando geração de códigos.');
                codigoClienteFieldExists = false;
            } else {
                // Outro erro, tentar continuar
                console.warn('⚠️ Erro ao verificar campo codigo_cliente:', error.message);
                codigoClienteFieldExists = false;
            }
        }

        // Verificar e gerar códigos de cliente se necessário (apenas se o campo existir)
        if (codigoClienteFieldExists) {
            try {
                // Verificar se há restaurantes sem código usando SQL direto
                const restaurantsWithoutCodeResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
                    SELECT COUNT(*)::int as count
                    FROM restaurants
                    WHERE id = ANY(${restaurantIds}::uuid[])
                    AND codigo_cliente IS NULL
                `;

                const restaurantsWithoutCode = Number(restaurantsWithoutCodeResult[0]?.count || 0);

                if (restaurantsWithoutCode > 0) {
                    console.log(`📝 Encontrados ${restaurantsWithoutCode} restaurantes sem código. Gerando códigos...`);

                    // Buscar o maior código existente usando SQL
                    const maxCodigoResult = await prisma.$queryRaw<Array<{ codigo_cliente: number | null }>>`
                        SELECT codigo_cliente
                        FROM restaurants
                        WHERE codigo_cliente IS NOT NULL
                        ORDER BY codigo_cliente DESC
                        LIMIT 1
                    `;

                    let currentCode = maxCodigoResult[0]?.codigo_cliente ? maxCodigoResult[0].codigo_cliente + 1 : 10000;

                    // Buscar restaurantes sem código usando SQL
                    const restaurantsToUpdate = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
                        SELECT id, name
                        FROM restaurants
                        WHERE id = ANY(${restaurantIds}::uuid[])
                        AND codigo_cliente IS NULL
                        ORDER BY created_at ASC
                    `;

                    // Atribuir códigos usando SQL
                    for (const restaurant of restaurantsToUpdate) {
                        // Verificar se o código já existe
                        const existingCode = await prisma.$queryRaw<Array<{ id: string }>>`
                            SELECT id FROM restaurants WHERE codigo_cliente = ${currentCode} LIMIT 1
                        `;

                        while (existingCode.length > 0) {
                            currentCode++;
                            const checkAgain = await prisma.$queryRaw<Array<{ id: string }>>`
                                SELECT id FROM restaurants WHERE codigo_cliente = ${currentCode} LIMIT 1
                            `;
                            if (checkAgain.length === 0) break;
                        }

                        await prisma.$executeRaw`
                            UPDATE restaurants
                            SET codigo_cliente = ${currentCode}
                            WHERE id = ${restaurant.id}::uuid
                        `;

                        console.log(`   ✅ Código ${currentCode} atribuído a ${restaurant.name}`);
                        currentCode++;
                    }

                    console.log(`✅ ${restaurantsToUpdate.length} códigos gerados!`);
                }
            } catch (error: any) {
                console.warn('⚠️ Erro ao gerar códigos:', error.message);
            }
        }

        // Buscar restaurantes selecionados - usar SQL direto se o campo existir, senão usar include
        // IMPORTANTE: Buscar DEPOIS de gerar os códigos para garantir que os códigos estejam disponíveis
        let restaurants: any[];

        if (codigoClienteFieldExists) {
            // Usar SQL direto para garantir que codigoCliente seja retornado
            // Buscar novamente para pegar os códigos recém-gerados
            const restaurantsResult = await prisma.$queryRaw<Array<{
                id: string;
                name: string;
                codigo_cliente: number | null;
                address: any;
                seller_id: string | null;
                seller_name: string | null;
            }>>`
                SELECT 
                    r.id,
                    r.name,
                    r.codigo_cliente,
                    r.address,
                    r.seller_id,
                    s.name as seller_name
                FROM restaurants r
                LEFT JOIN sellers s ON r.seller_id = s.id
                WHERE r.id = ANY(${restaurantIds}::uuid[])
                ORDER BY r.name ASC
            `;

            restaurants = restaurantsResult.map(r => ({
                id: r.id,
                name: r.name,
                codigoCliente: r.codigo_cliente,
                address: typeof r.address === 'string' ? JSON.parse(r.address) : r.address,
                seller: r.seller_name ? { name: r.seller_name } : null
            }));

            console.log(`\n📊 Total de restaurantes encontrados: ${restaurants.length}`);
            const withCode = restaurants.filter((r: any) => r.codigoCliente !== null && r.codigoCliente !== undefined);
            const withoutCode = restaurants.filter((r: any) => !r.codigoCliente);
            console.log(`📊 Restaurantes COM código: ${withCode.length}`);
            console.log(`📊 Restaurantes SEM código: ${withoutCode.length}`);

            if (withoutCode.length > 0) {
                console.warn(`\n⚠️ ATENÇÃO: ${withoutCode.length} restaurantes ainda não têm código!`);
                console.warn(`   IDs sem código:`, withoutCode.map((r: any) => r.id).slice(0, 5).join(', '));
            }

            if (withCode.length > 0) {
                console.log(`\n✅ Exemplos de códigos gerados:`);
                withCode.slice(0, 5).forEach((r: any) => {
                    console.log(`   - ${r.name}: código ${r.codigoCliente}`);
                });
            }
        } else {
            // Campo não existe, usar include sem codigoCliente
            restaurants = await prisma.restaurant.findMany({
                where: {
                    id: { in: restaurantIds }
                },
                include: {
                    seller: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Adicionar codigoCliente como null para todos
            restaurants = restaurants.map((r: any) => ({
                ...r,
                codigoCliente: null
            }));

            console.log(`\n⚠️ Campo codigo_cliente não existe no banco. Todos os códigos serão vazios.`);
            console.log(`📊 Total de restaurantes encontrados: ${restaurants.length}`);
        }

        // Carregar o template original
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(finalTemplatePath);

        // Obter a primeira planilha (que contém o template)
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new Error('Planilha não encontrada no template');
        }

        // Encontrar a linha de cabeçalho (geralmente linha 1)
        // Procurar pela linha que contém "Nome", "E-mail", etc.
        let headerRow = 1;
        let foundHeader = false;

        // Verificar se a linha 1 tem os cabeçalhos esperados
        const firstRow = worksheet.getRow(1);
        const firstRowValues = firstRow.values as any[];
        if (firstRowValues && firstRowValues.length > 0) {
            const firstRowText = firstRowValues.join('').toLowerCase();
            if (firstRowText.includes('nome') && firstRowText.includes('e-mail')) {
                foundHeader = true;
                headerRow = 1;
            }
        }

        // Se não encontrou na linha 1, procurar nas próximas linhas
        if (!foundHeader) {
            for (let row = 1; row <= 10; row++) {
                const rowData = worksheet.getRow(row);
                const rowValues = rowData.values as any[];
                if (rowValues && rowValues.length > 0) {
                    const rowText = rowValues.join('').toLowerCase();
                    if (rowText.includes('nome') && rowText.includes('e-mail')) {
                        headerRow = row;
                        foundHeader = true;
                        break;
                    }
                }
            }
        }

        // Se não encontrou o cabeçalho, usar linha 1 como padrão
        if (!foundHeader) {
            headerRow = 1;
        }

        // Limpar dados de exemplo (manter apenas o cabeçalho na linha 1)
        // Deletar todas as linhas após o cabeçalho até o final
        // Os dados começarão na linha 2 (A2)
        const lastRow = worksheet.rowCount;
        if (lastRow > headerRow) {
            // Deletar todas as linhas após o cabeçalho (começando da linha headerRow + 1)
            // Usar spliceRows para remover todas as linhas de dados
            const rowsToDelete = lastRow - headerRow;
            if (rowsToDelete > 0) {
                worksheet.spliceRows(headerRow + 1, rowsToDelete);
            }
        }

        // Garantir que não há linhas vazias entre o cabeçalho e onde vamos adicionar os dados
        // Verificar se há linhas vazias após o cabeçalho e removê-las
        let nextRowToCheck = headerRow + 1;
        while (worksheet && nextRowToCheck <= worksheet.rowCount) {
            const row = worksheet.getRow(nextRowToCheck);
            const rowValues = row.values as any[];
            const hasData = rowValues && rowValues.some((val: any) => val !== null && val !== undefined && val !== '');
            if (!hasData) {
                // Se a linha está vazia, removê-la
                worksheet.spliceRows(nextRowToCheck, 1);
            } else {
                // Se encontrou dados, parar (mas não deveria ter dados aqui)
                break;
            }
        }

        // Mapear colunas do template
        const headerRowData = worksheet.getRow(headerRow);
        const headerValues = headerRowData.values as any[];

        console.log(`\n📋 Mapeando colunas do template (linha ${headerRow})...`);
        console.log(`   Valores do cabeçalho:`, headerValues.map((v, i) => `[${i}]: "${v}"`).join(', '));

        // Criar mapa de colunas (índice da coluna -> nome do campo)
        const columnMap: { [key: string]: number } = {};

        // PRIMEIRO: Mapear especificamente a coluna B (índice 2 no ExcelJS) como "Nome"
        // No ExcelJS, as colunas começam em 1: A=1, B=2, C=3, etc.
        // Mas no array headerValues, o índice 0 = A, índice 1 = B, índice 2 = C
        // Então coluna B = headerValues[1] mas célula.getCell(2)
        if (headerValues.length > 1) {
            const colunaBValue = headerValues[1]; // Índice 1 no array = Coluna B
            if (colunaBValue && typeof colunaBValue === 'string') {
                const colunaBNormalized = colunaBValue.trim().toLowerCase();
                if (colunaBNormalized === 'nome' || colunaBNormalized.startsWith('nome')) {
                    columnMap['Nome'] = 2; // Coluna B = índice 2 no ExcelJS (getCell usa índice baseado em 1)
                    console.log(`   ✅ Coluna B identificada como "Nome" (valor: "${colunaBValue}") - será preenchida no índice 2`);
                } else {
                    console.warn(`   ⚠️ Coluna B não contém "Nome"! Valor encontrado: "${colunaBValue}"`);
                }
            }
        }

        // Depois mapear outras colunas
        headerValues.forEach((value, index) => {
            if (value && typeof value === 'string') {
                const normalizedValue = value.trim().toLowerCase();

                // Se já mapeamos a coluna B como "Nome", não mapear outras colunas com "nome"
                if (columnMap['Nome'] !== undefined && index === columnMap['Nome']) {
                    // Já mapeado, pular
                } else if (normalizedValue.includes('e-mail') || normalizedValue.includes('email')) {
                    columnMap['E-mail'] = index;
                } else if (normalizedValue.includes('telefone')) {
                    columnMap['Telefone'] = index;
                } else if (normalizedValue.includes('celular')) {
                    columnMap['Celular'] = index;
                } else if (normalizedValue.includes('logradouro') || normalizedValue.includes('logadouro')) {
                    columnMap['Logradouro'] = index;
                    console.log(`   ✅ Coluna "Logradouro" encontrada na coluna ${index}`);
                } else if (normalizedValue.includes('endereço') || normalizedValue.includes('endereco')) {
                    columnMap['Endereço'] = index;
                } else if (normalizedValue.includes('número') || normalizedValue.includes('numero')) {
                    columnMap['Número'] = index;
                } else if (normalizedValue.includes('complemento')) {
                    columnMap['Complemento'] = index;
                } else if (normalizedValue.includes('bairro') || normalizedValue.includes('localidade')) {
                    columnMap['Bairro/Localidade'] = index;
                } else if (normalizedValue.includes('país') || normalizedValue.includes('pais')) {
                    columnMap['País'] = index;
                } else if (normalizedValue.includes('estado') || normalizedValue.includes('província') || normalizedValue.includes('provincia')) {
                    columnMap['Estado/Província'] = index;
                } else if (normalizedValue.includes('cidade')) {
                    columnMap['Cidade'] = index;
                } else if (normalizedValue.includes('código postal') || normalizedValue.includes('codigo postal') || normalizedValue.includes('cep')) {
                    columnMap['Código Postal'] = index;
                } else if (normalizedValue.includes('coordenadas')) {
                    columnMap['Coordenadas'] = index;
                } else if (normalizedValue.includes('ativo')) {
                    columnMap['Ativo'] = index;
                } else if (normalizedValue === 'código' || normalizedValue === 'codigo' || (normalizedValue.includes('codigo') && !normalizedValue.includes('postal') && !normalizedValue.includes('cliente'))) {
                    columnMap['Código'] = index;
                    console.log(`   ✅ Coluna "Código" encontrada na coluna ${index} (valor: "${value}")`);
                } else if (normalizedValue.includes('código cliente') || normalizedValue.includes('codigo cliente')) {
                    // Fallback para template antigo
                    columnMap['Código Cliente'] = index;
                    console.log(`   ✅ Coluna "Código Cliente" (antiga) encontrada na coluna ${index} (valor: "${value}")`);
                } else if (normalizedValue.includes('clientes') && !normalizedValue.includes('nome')) {
                    // Fallback para template antigo
                    columnMap['Clientes'] = index;
                }
                // NÃO mapear outras colunas com "nome" - apenas a coluna B
            }
        });

        console.log(`\n📊 Colunas mapeadas:`, Object.keys(columnMap).map(k => `${k}: coluna ${columnMap[k]}`).join(', '));

        if (!columnMap['Código Cliente']) {
            console.warn(`\n⚠️ ATENÇÃO: Coluna "Código Cliente" NÃO foi encontrada no template!`);
            console.warn(`   Procurando por variações...`);
            // Tentar encontrar por outras variações
            headerValues.forEach((value, index) => {
                if (value && typeof value === 'string') {
                    const v = value.trim().toLowerCase();
                    if (v.includes('cod') || v.includes('cód')) {
                        console.log(`   Possível coluna relacionada na coluna ${index}: "${value}"`);
                    }
                }
            });
        }

        // Adicionar dados dos restaurantes começando na linha 2 (A2)
        console.log(`\n📝 Preenchendo dados de ${restaurants.length} restaurantes...`);
        restaurants.forEach((r: any, index: number) => {
            // Acessar codigoCliente - agora garantido que está no select
            const codigoCliente = r.codigoCliente;
            const address = typeof r.address === 'string' ? JSON.parse(r.address) : r.address;

            // Log detalhado para debug
            console.log(`\n   [${index + 1}/${restaurants.length}] Restaurante: ${r.name}`);
            console.log(`      Código Cliente (raw): ${codigoCliente} (tipo: ${typeof codigoCliente})`);
            console.log(`      Código Cliente (string): ${codigoCliente !== null && codigoCliente !== undefined ? String(codigoCliente) : 'VAZIO'}`);

            // Extrair CEP (tentar várias variações)
            const cep = address?.zip ||
                address?.cep ||
                address?.postal_code ||
                address?.postalCode ||
                address?.CEP ||
                '';

            // Extrair endereço, número e bairro separadamente
            const enderecoCompleto = address?.street || address?.address || '';
            // Tentar separar número do endereço (formato comum: "Rua Exemplo, 123")
            let endereco = enderecoCompleto;
            let numero = '';

            if (enderecoCompleto) {
                const numeroMatch = enderecoCompleto.match(/,\s*(\d+)/);
                if (numeroMatch) {
                    numero = numeroMatch[1];
                    endereco = enderecoCompleto.replace(/,\s*\d+.*$/, '').trim();
                } else {
                    // Tentar outro formato: "Rua Exemplo 123"
                    const numeroMatch2 = enderecoCompleto.match(/\s+(\d+)$/);
                    if (numeroMatch2) {
                        numero = numeroMatch2[1];
                        endereco = enderecoCompleto.replace(/\s+\d+$/, '').trim();
                    }
                }
            }

            const bairro = address?.neighborhood || address?.bairro || '';

            // Criar nova linha diretamente na posição correta (linha 2, 3, 4, etc.)
            // A primeira linha de dados será na linha 2 (A2)
            // Calcular o número da linha: headerRow (1) + 1 + index (0, 1, 2, ...)
            const targetRowNumber = headerRow + 1 + index;

            // Obter a linha na posição correta (criará se não existir)
            const newRow = worksheet.getRow(targetRowNumber);

            // IMPORTANTE: Nome do restaurante (nome do cliente) vai APENAS na coluna B
            // No ExcelJS, as colunas começam em 1: A=1, B=2, C=3, etc.
            // Coluna B = índice 2 (não 1!)
            const colunaBIndex = 2; // Coluna B = índice 2 no ExcelJS
            const nomeCell = newRow.getCell(colunaBIndex);
            nomeCell.value = r.name || '';
            console.log(`      ✅ Nome do restaurante preenchido na COLUNA B (índice ${colunaBIndex}, célula ${nomeCell.address}): "${r.name}"`);

            // Verificar se a coluna B realmente tem "Nome" no cabeçalho
            const headerCellB = worksheet.getCell(headerRow, colunaBIndex);
            if (headerCellB && headerCellB.value) {
                const headerValue = String(headerCellB.value).trim();
                console.log(`      ✅ Confirmado: Coluna B tem cabeçalho "${headerValue}"`);
            } else {
                console.warn(`      ⚠️ ATENÇÃO: Coluna B não tem cabeçalho ou está vazia!`);
            }
            if (columnMap['E-mail'] !== undefined) {
                newRow.getCell(columnMap['E-mail']).value = '';
            }
            if (columnMap['Telefone'] !== undefined) {
                newRow.getCell(columnMap['Telefone']).value = '';
            }
            if (columnMap['Celular'] !== undefined) {
                newRow.getCell(columnMap['Celular']).value = '';
            }
            // Preencher Logradouro (endereço completo sem número)
            if (columnMap['Logradouro'] !== undefined) {
                newRow.getCell(columnMap['Logradouro']).value = endereco;
                console.log(`      ✅ Logradouro preenchido: "${endereco}"`);
            }
            if (columnMap['Endereço'] !== undefined) {
                newRow.getCell(columnMap['Endereço']).value = endereco;
            }
            if (columnMap['Número'] !== undefined) {
                newRow.getCell(columnMap['Número']).value = numero;
            }
            if (columnMap['Complemento'] !== undefined) {
                newRow.getCell(columnMap['Complemento']).value = '';
            }
            if (columnMap['Bairro/Localidade'] !== undefined) {
                newRow.getCell(columnMap['Bairro/Localidade']).value = bairro;
            }
            if (columnMap['País'] !== undefined) {
                newRow.getCell(columnMap['País']).value = 'Brasil';
            }
            if (columnMap['Estado/Província'] !== undefined) {
                newRow.getCell(columnMap['Estado/Província']).value = address?.state || address?.estado || '';
            }
            if (columnMap['Cidade'] !== undefined) {
                newRow.getCell(columnMap['Cidade']).value = address?.city || address?.cidade || '';
            }
            if (columnMap['Código Postal'] !== undefined) {
                newRow.getCell(columnMap['Código Postal']).value = cep;
            }
            if (columnMap['Coordenadas'] !== undefined) {
                newRow.getCell(columnMap['Coordenadas']).value = '';
            }
            if (columnMap['Ativo'] !== undefined) {
                newRow.getCell(columnMap['Ativo']).value = 'Sim';
            }
            // Preencher Código (novo template) ou Código Cliente (template antigo)
            if (columnMap['Código'] !== undefined) {
                const codigoValue = codigoCliente !== null && codigoCliente !== undefined ? String(codigoCliente) : '';
                const codigoCell = newRow.getCell(columnMap['Código']);
                console.log(`      Preenchendo coluna "Código" (${columnMap['Código']}) com valor: "${codigoValue}"`);
                if (codigoCell) {
                    codigoCell.value = codigoValue;
                    console.log(`      ✅ Valor "${codigoValue}" atribuído à célula ${codigoCell.address}`);
                }
            } else if (columnMap['Código Cliente'] !== undefined) {
                // Fallback para template antigo
                const codigoValue = codigoCliente !== null && codigoCliente !== undefined ? String(codigoCliente) : '';
                const codigoCell = newRow.getCell(columnMap['Código Cliente']);
                console.log(`      Preenchendo coluna "Código Cliente" (${columnMap['Código Cliente']}) com valor: "${codigoValue}"`);
                if (codigoCell) {
                    codigoCell.value = codigoValue;
                    console.log(`      ✅ Valor "${codigoValue}" atribuído à célula ${codigoCell.address}`);
                }
            } else {
                console.warn(`   ⚠️ Coluna "Código" ou "Código Cliente" não encontrada no template!`);
                // Tentar encontrar manualmente
                for (let col = 1; col <= 10; col++) {
                    const cell = worksheet.getCell(headerRow, col);
                    if (cell && cell.value) {
                        const cellValue = String(cell.value).toLowerCase().trim();
                        if (cellValue === 'código' || cellValue === 'codigo' || (cellValue.includes('codigo') && !cellValue.includes('postal'))) {
                            console.log(`      ✅ Encontrada coluna "Código" na coluna ${col} (valor: "${cell.value}")`);
                            const codigoValue = codigoCliente !== null && codigoCliente !== undefined ? String(codigoCliente) : '';
                            const targetCell = newRow.getCell(col);
                            if (targetCell) {
                                targetCell.value = codigoValue;
                                console.log(`      ✅ Valor "${codigoValue}" atribuído à célula ${targetCell.address}`);
                            }
                            break;
                        }
                    }
                }
            }

            // Preencher Clientes (template antigo) - apenas se existir e NÃO for o novo template
            // No novo template, o nome já foi preenchido na coluna "Nome" acima
            if (columnMap['Clientes'] !== undefined && columnMap['Nome'] === undefined) {
                // Template antigo: preencher "Clientes" com nome do restaurante apenas se não houver coluna "Nome"
                newRow.getCell(columnMap['Clientes']).value = r.name || '';
                console.log(`      Preenchendo coluna "Clientes" (template antigo) com: "${r.name}"`);
            }
        });

        // Converter para buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Converter para base64
        const base64 = Buffer.from(buffer).toString('base64');

        return {
            success: true,
            data: base64,
            filename: `Checkmob_Cadastro_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`,
            count: restaurants.length
        };
    } catch (error: any) {
        console.error('Erro ao exportar restaurantes para Checkmob:', error);
        return {
            success: false,
            error: error.message || 'Erro ao exportar restaurantes para Checkmob'
        };
    }
}

// Função para gerar códigos de cliente para todos os restaurantes que não têm código
export async function generateMissingCodigoCliente(): Promise<{ success: boolean; generated: number; error?: string }> {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        // Verificar se há restaurantes sem código
        const restaurantsWithoutCode = await prisma.restaurant.findMany({
            where: {
                codigoCliente: null
            },
            orderBy: {
                createdAt: 'asc'
            },
            select: {
                id: true,
                name: true
            }
        });

        if (restaurantsWithoutCode.length === 0) {
            return { success: true, generated: 0 };
        }

        // Buscar o maior código existente
        const maxCodigo = await prisma.restaurant.findFirst({
            where: {
                codigoCliente: {
                    not: null
                }
            },
            orderBy: {
                codigoCliente: 'desc'
            },
            select: {
                codigoCliente: true
            }
        });

        let currentCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;
        let generated = 0;

        console.log(`📝 Gerando códigos para ${restaurantsWithoutCode.length} restaurantes, começando em ${currentCode}...`);

        // Atribuir códigos sequencialmente
        for (const restaurant of restaurantsWithoutCode) {
            // Verificar se o código já existe
            while (await prisma.restaurant.findFirst({
                where: { codigoCliente: currentCode }
            })) {
                currentCode++;
            }

            await prisma.restaurant.update({
                where: { id: restaurant.id },
                data: { codigoCliente: currentCode }
            });

            generated++;
            if (generated % 100 === 0) {
                console.log(`   ✅ ${generated} códigos gerados...`);
            }

            currentCode++;
        }

        console.log(`✅ Total de ${generated} códigos gerados!`);

        return { success: true, generated };

    } catch (error: any) {
        console.error('Erro ao gerar códigos:', error);
        return {
            success: false,
            generated: 0,
            error: error.message || 'Erro ao gerar códigos de cliente'
        };
    }
}

// Função para verificar status dos códigos de cliente
export async function checkCodigoClienteStatus(): Promise<{ total: number; withCode: number; withoutCode: number; nextCode: number }> {
    'use server';

    try {
        const { prisma } = await import('@/lib/db');

        const total = await prisma.restaurant.count();
        const withCode = await prisma.restaurant.count({
            where: {
                codigoCliente: {
                    not: null
                }
            }
        });
        const withoutCode = total - withCode;

        const maxCodigo = await prisma.restaurant.findFirst({
            where: {
                codigoCliente: {
                    not: null
                }
            },
            orderBy: {
                codigoCliente: 'desc'
            },
            select: {
                codigoCliente: true
            }
        });

        const nextCode = maxCodigo?.codigoCliente ? maxCodigo.codigoCliente + 1 : 10000;

        return {
            total,
            withCode,
            withoutCode,
            nextCode
        };

    } catch (error: any) {
        console.error('Erro ao verificar status:', error);
        return {
            total: 0,
            withCode: 0,
            withoutCode: 0,
            nextCode: 10000
        };
    }
}

// Função findSellerByZona removida - sistema agora usa apenas atribuição geográfica via Google Maps
