'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface ZonaCepData {
    id?: string;
    zonaNome: string;
    cepInicial: string;
    cepFinal: string;
    regiao?: string;
    ativo: boolean;
}

// Função para garantir que a tabela existe
async function ensureTableExists() {
    try {
        // Verificar se a tabela existe
        await prisma.$queryRaw`SELECT 1 FROM zonas_cep LIMIT 1`;
    } catch (error: any) {
        // Se a tabela não existir (código 42P01), criar
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
            console.log('Criando tabela zonas_cep...');
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS zonas_cep (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    zona_nome VARCHAR(100) NOT NULL,
                    cep_inicial VARCHAR(9) NOT NULL,
                    cep_final VARCHAR(9) NOT NULL,
                    ativo BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                    updated_at TIMESTAMPTZ(6) DEFAULT NOW()
                )
            `;
            
            // Criar índices
            await prisma.$executeRaw`
                CREATE INDEX IF NOT EXISTS idx_zonas_cep_ativo ON zonas_cep(ativo)
            `;
            await prisma.$executeRaw`
                CREATE INDEX IF NOT EXISTS idx_zonas_cep_range ON zonas_cep(cep_inicial, cep_final)
            `;
            
            console.log('Tabela zonas_cep criada com sucesso!');
        } else {
            throw error;
        }
    }
}

// Limpar CEP (remover caracteres especiais)
function cleanCep(cep: string): string {
    return cep.replace(/[^0-9]/g, '');
}

// Validar formato de CEP
function validateCep(cep: string): boolean {
    const cleaned = cleanCep(cep);
    return cleaned.length === 8;
}

// Converter CEP para número para comparação
function cepToNumber(cep: string): number {
    return parseInt(cleanCep(cep), 10);
}

// Verificar se há sobreposição de ranges
async function checkOverlap(cepInicial: string, cepFinal: string, excludeId?: string): Promise<boolean> {
    const inicio = cepToNumber(cepInicial);
    const fim = cepToNumber(cepFinal);

    if (inicio > fim) {
        throw new Error('CEP inicial deve ser menor ou igual ao CEP final');
    }

    // Garantir que a tabela existe
    await ensureTableExists();

    // Buscar zonas (usar modelo se disponível, senão SQL direto)
    let zonas: any[] = [];
    
    try {
        if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
            zonas = await (prisma as any).zonaCep.findMany({
                where: {
                    ativo: true,
                    ...(excludeId ? { id: { not: excludeId } } : {})
                }
            });
        } else {
            // Fallback: usar SQL direto
            const result = excludeId
                ? await prisma.$queryRaw<Array<{
                    id: string;
                    zona_nome: string;
                    cep_inicial: string;
                    cep_final: string;
                    ativo: boolean;
                }>>`SELECT * FROM zonas_cep WHERE ativo = true AND id != ${excludeId}`
                : await prisma.$queryRaw<Array<{
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
    } catch (error: any) {
        // Se a tabela não existir, não há sobreposição
        if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
            return false;
        }
        throw error;
    }

    for (const zona of zonas) {
        // SQL retorna snake_case, modelo retorna camelCase
        const cepInicial = (zona as any).cepInicial || (zona as any).cep_inicial;
        const cepFinal = (zona as any).cepFinal || (zona as any).cep_final;
        const zonaInicio = cepToNumber(cepInicial);
        const zonaFim = cepToNumber(cepFinal);

        // Verificar sobreposição
        if (
            (inicio >= zonaInicio && inicio <= zonaFim) ||
            (fim >= zonaInicio && fim <= zonaFim) ||
            (inicio <= zonaInicio && fim >= zonaFim)
        ) {
            return true;
        }
    }

    return false;
}

export async function createZona(data: Omit<ZonaCepData, 'id'>) {
    try {
        // Garantir que a tabela existe
        await ensureTableExists();
        
        // Validar CEPs
        if (!validateCep(data.cepInicial) || !validateCep(data.cepFinal)) {
            throw new Error('CEP deve ter 8 dígitos');
        }

        // Verificar sobreposição
        const hasOverlap = await checkOverlap(data.cepInicial, data.cepFinal);
        if (hasOverlap) {
            throw new Error('Range de CEP sobrepõe com uma zona existente');
        }

        // Tentar usar o modelo se disponível, senão usar SQL direto
        let zona;
        try {
            if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                zona = await (prisma as any).zonaCep.create({
                    data: {
                        zonaNome: data.zonaNome,
                        cepInicial: cleanCep(data.cepInicial),
                        cepFinal: cleanCep(data.cepFinal),
                        regiao: data.regiao || null,
                        ativo: data.ativo
                    }
                });
            } else {
                throw new Error('Modelo não disponível, usar SQL direto');
            }
        } catch (modelError: any) {
            // Se o modelo não funcionar, usar SQL direto
            const result = await prisma.$queryRaw<Array<{
                id: string;
                zona_nome: string;
                cep_inicial: string;
                cep_final: string;
                regiao?: string;
                ativo: boolean;
            }>>`
                INSERT INTO zonas_cep (id, zona_nome, cep_inicial, cep_final, regiao, ativo, created_at, updated_at)
                VALUES (gen_random_uuid(), ${data.zonaNome}, ${cleanCep(data.cepInicial)}, ${cleanCep(data.cepFinal)}, ${data.regiao || null}, ${data.ativo}, NOW(), NOW())
                RETURNING *
            `;
            const rawZona = Array.isArray(result) ? result[0] : result;
            // Converter snake_case para camelCase
            zona = {
                id: rawZona.id,
                zonaNome: rawZona.zona_nome,
                cepInicial: rawZona.cep_inicial,
                cepFinal: rawZona.cep_final,
                regiao: (rawZona as any).regiao,
                ativo: rawZona.ativo
            };
        }

        revalidatePath('/admin/zonas');
        return zona;
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar zona');
    }
}

export async function updateZona(id: string, data: Omit<ZonaCepData, 'id'>) {
    try {
        // Validar CEPs
        if (!validateCep(data.cepInicial) || !validateCep(data.cepFinal)) {
            throw new Error('CEP deve ter 8 dígitos');
        }

        // Verificar sobreposição (excluindo a zona atual)
        const hasOverlap = await checkOverlap(data.cepInicial, data.cepFinal, id);
        if (hasOverlap) {
            throw new Error('Range de CEP sobrepõe com uma zona existente');
        }

        // Tentar usar o modelo se disponível, senão usar SQL direto
        let zona;
        try {
            if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                zona = await (prisma as any).zonaCep.update({
                    where: { id },
                    data: {
                        zonaNome: data.zonaNome,
                        cepInicial: cleanCep(data.cepInicial),
                        cepFinal: cleanCep(data.cepFinal),
                        regiao: data.regiao || null,
                        ativo: data.ativo
                    }
                });
            } else {
                throw new Error('Modelo não disponível, usar SQL direto');
            }
        } catch (modelError: any) {
            // Se o modelo não funcionar, usar SQL direto
            const result = await prisma.$queryRaw<Array<{
                id: string;
                zona_nome: string;
                cep_inicial: string;
                cep_final: string;
                regiao?: string;
                ativo: boolean;
            }>>`
                UPDATE zonas_cep 
                SET zona_nome = ${data.zonaNome},
                    cep_inicial = ${cleanCep(data.cepInicial)},
                    cep_final = ${cleanCep(data.cepFinal)},
                    regiao = ${data.regiao || null},
                    ativo = ${data.ativo},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;
            const rawZona = Array.isArray(result) ? result[0] : result;
            // Converter snake_case para camelCase
            zona = {
                id: rawZona.id,
                zonaNome: rawZona.zona_nome,
                cepInicial: rawZona.cep_inicial,
                cepFinal: rawZona.cep_final,
                regiao: (rawZona as any).regiao,
                ativo: rawZona.ativo
            };
        }

        revalidatePath('/admin/zonas');
        return zona;
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao atualizar zona');
    }
}

export async function deleteZona(id: string) {
    try {
        // Verificar se há restaurantes usando esta zona
        const restaurantsCount = await prisma.restaurant.count({
            where: { zonaId: id }
        });

        if (restaurantsCount > 0) {
            throw new Error(`Não é possível excluir: ${restaurantsCount} restaurante(s) estão usando esta zona`);
        }

        // Tentar usar o modelo se disponível, senão usar SQL direto
        try {
            if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                await (prisma as any).zonaCep.delete({
                    where: { id }
                });
            } else {
                throw new Error('Modelo não disponível, usar SQL direto');
            }
        } catch (modelError: any) {
            // Se o modelo não funcionar, usar SQL direto
            await prisma.$executeRaw`DELETE FROM zonas_cep WHERE id = ${id}`;
        }

        revalidatePath('/admin/zonas');
        return { success: true };
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao excluir zona');
    }
}

export async function getZonas() {
    try {
        // Garantir que a tabela existe
        await ensureTableExists();
        
        if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
            return await (prisma as any).zonaCep.findMany({
                orderBy: [
                    { ativo: 'desc' },
                    { zonaNome: 'asc' }
                ]
            });
        } else {
            // Fallback: usar SQL direto
            const result = await prisma.$queryRaw<Array<{
                id: string;
                zona_nome: string;
                cep_inicial: string;
                cep_final: string;
                ativo: boolean;
            }>>`
                SELECT * FROM zonas_cep 
                ORDER BY ativo DESC, zona_nome ASC
            `;
            return result.map(z => ({
                id: z.id,
                zonaNome: z.zona_nome,
                cepInicial: z.cep_inicial,
                cepFinal: z.cep_final,
                ativo: z.ativo
            }));
        }
    } catch (error: any) {
        // Se a tabela não existir, retornar array vazio
        if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
            return [];
        }
        throw new Error('Erro ao buscar zonas');
    }
}

// Função para popular zonas padrão
export async function seedZonasPadrao() {
    try {
        // Garantir que a tabela existe
        await ensureTableExists();
        
        const zonasPadrao = [
            { zonaNome: 'São Paulo - Centro', cepInicial: '01000000', cepFinal: '01599999', regiao: 'SP Capital' },
            { zonaNome: 'São Paulo - Zona Norte', cepInicial: '02000000', cepFinal: '02999999', regiao: 'SP Capital' },
            { zonaNome: 'São Paulo - Zona Leste 1', cepInicial: '03000000', cepFinal: '03599999', regiao: 'SP Capital' },
            { zonaNome: 'São Paulo - Zona Leste 2', cepInicial: '08000000', cepFinal: '08499999', regiao: 'SP Capital' },
            { zonaNome: 'São Paulo - Zona Sul', cepInicial: '04000000', cepFinal: '04899999', regiao: 'SP Capital' },
            { zonaNome: 'São Paulo - Zona Oeste', cepInicial: '05000000', cepFinal: '05999999', regiao: 'SP Capital' },
            { zonaNome: 'Guarulhos - Geral', cepInicial: '07000000', cepFinal: '07499999', regiao: 'Grande SP' },
            { zonaNome: 'Osasco', cepInicial: '06000000', cepFinal: '06299999', regiao: 'Grande SP' },
            { zonaNome: 'Barueri/Alphaville', cepInicial: '06400000', cepFinal: '06499999', regiao: 'Grande SP' },
            { zonaNome: 'Taboão da Serra', cepInicial: '06760000', cepFinal: '06769999', regiao: 'Grande SP' },
            { zonaNome: 'Santo André', cepInicial: '09000000', cepFinal: '09299999', regiao: 'ABC' },
            { zonaNome: 'São Bernardo do Campo', cepInicial: '09700000', cepFinal: '09899999', regiao: 'ABC' },
            { zonaNome: 'São Caetano do Sul', cepInicial: '09500000', cepFinal: '09599999', regiao: 'ABC' },
            { zonaNome: 'Diadema', cepInicial: '09900000', cepFinal: '09999999', regiao: 'ABC' },
            { zonaNome: 'Mauá', cepInicial: '09300000', cepFinal: '09399999', regiao: 'ABC' },
            { zonaNome: 'Sorocaba - Centro/Sul', cepInicial: '18000000', cepFinal: '18079999', regiao: 'Interior' },
            { zonaNome: 'Sorocaba - Norte/Leste', cepInicial: '18080000', cepFinal: '18199999', regiao: 'Interior' },
            { zonaNome: 'Campinas - Geral', cepInicial: '13000000', cepFinal: '13149999', regiao: 'Interior' },
            { zonaNome: 'Jundiaí', cepInicial: '13200000', cepFinal: '13219999', regiao: 'Interior' },
        ];

        let created = 0;
        let skipped = 0;

        for (const zona of zonasPadrao) {
            try {
                // Verificar se já existe uma zona com o mesmo nome
                const existing = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM zonas_cep WHERE zona_nome = ${zona.zonaNome} LIMIT 1
                `;

                if (existing.length > 0) {
                    skipped++;
                    continue;
                }

                // Criar a zona
                await prisma.$executeRaw`
                    INSERT INTO zonas_cep (id, zona_nome, cep_inicial, cep_final, regiao, ativo, created_at, updated_at)
                    VALUES (gen_random_uuid(), ${zona.zonaNome}, ${zona.cepInicial}, ${zona.cepFinal}, ${zona.regiao || null}, true, NOW(), NOW())
                `;
                created++;
            } catch (error: any) {
                console.error(`Erro ao criar zona ${zona.zonaNome}:`, error.message);
            }
        }

        revalidatePath('/admin/zonas');
        return { 
            success: true, 
            created, 
            skipped,
            message: `${created} zonas criadas, ${skipped} já existiam`
        };
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao popular zonas padrão');
    }
}

// Função para adicionar zonas de Sorocaba e atribuir ao executivo Cicero
export async function seedZonasSorocaba() {
    'use server';
    
    try {
        await ensureTableExists();
        
        const zonasSorocaba = [
            { zonaNome: 'Sorocaba Centro', cepInicial: '18000-000', cepFinal: '18039-999' },
            { zonaNome: 'Sorocaba Zona Norte', cepInicial: '18040-000', cepFinal: '18054-999' },
            { zonaNome: 'Sorocaba Zona Leste', cepInicial: '18055-000', cepFinal: '18069-999' },
            { zonaNome: 'Sorocaba Zona Oeste', cepInicial: '18070-000', cepFinal: '18079-999' },
            { zonaNome: 'Sorocaba Zona Sul', cepInicial: '18080-000', cepFinal: '18109-999' },
        ];

        let created = 0;
        let skipped = 0;
        const todasZonasSorocabaIds: string[] = [];

        for (const zona of zonasSorocaba) {
            try {
                // Limpar CEPs para busca e criação
                const cepInicialLimpo = cleanCep(zona.cepInicial);
                const cepFinalLimpo = cleanCep(zona.cepFinal);
                
                // Verificar se já existe uma zona com o mesmo nome ou mesmo range de CEP
                const existing = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM zonas_cep 
                    WHERE zona_nome = ${zona.zonaNome} 
                    OR (cep_inicial = ${cepInicialLimpo} AND cep_final = ${cepFinalLimpo})
                    LIMIT 1
                `;

                if (existing.length > 0) {
                    skipped++;
                    todasZonasSorocabaIds.push(existing[0].id);
                    continue;
                }
                
                // Criar a zona
                const result = await prisma.$queryRaw<Array<{ id: string }>>`
                    INSERT INTO zonas_cep (id, zona_nome, cep_inicial, cep_final, ativo, created_at, updated_at)
                    VALUES (gen_random_uuid(), ${zona.zonaNome}, ${cepInicialLimpo}, ${cepFinalLimpo}, true, NOW(), NOW())
                    RETURNING id
                `;
                
                if (result && result.length > 0) {
                    todasZonasSorocabaIds.push(result[0].id);
                    created++;
                }
            } catch (error: any) {
                console.error(`Erro ao criar zona ${zona.zonaNome}:`, error.message);
            }
        }

        // Buscar o executivo Cicero
        let ciceroId: string | null = null;
        try {
            const cicero = await prisma.seller.findFirst({
                where: {
                    name: {
                        contains: 'Cicero',
                        mode: 'insensitive'
                    }
                }
            });
            
            if (cicero) {
                ciceroId = cicero.id;
            } else {
                // Tentar buscar por email
                const ciceroByEmail = await prisma.seller.findFirst({
                    where: {
                        email: {
                            contains: 'cicero',
                            mode: 'insensitive'
                        }
                    }
                });
                if (ciceroByEmail) {
                    ciceroId = ciceroByEmail.id;
                }
            }
        } catch (error: any) {
            console.warn('Erro ao buscar executivo Cicero:', error.message);
        }

        // Atribuir TODAS as zonas de Sorocaba ao executivo Cicero (incluindo as que já existiam)
        let assigned = 0;
        if (ciceroId && todasZonasSorocabaIds.length > 0) {
            try {
                // Garantir que a tabela seller_zonas existe
                try {
                    await prisma.$queryRaw`SELECT 1 FROM seller_zonas LIMIT 1`;
                } catch (e: any) {
                    // Se não existir, criar
                    if (e.code === '42P01' || e.message?.includes('does not exist')) {
                        await prisma.$executeRaw`
                            CREATE TABLE IF NOT EXISTS seller_zonas (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                seller_id UUID NOT NULL,
                                zona_id UUID NOT NULL,
                                created_at TIMESTAMPTZ(6) DEFAULT NOW(),
                                CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
                                CONSTRAINT fk_zona FOREIGN KEY (zona_id) REFERENCES zonas_cep(id) ON DELETE CASCADE,
                                CONSTRAINT unique_seller_zona UNIQUE (seller_id, zona_id)
                            )
                        `;
                    }
                }
                
                for (const zonaId of todasZonasSorocabaIds) {
                    try {
                        await prisma.$executeRaw`
                            INSERT INTO seller_zonas (id, seller_id, zona_id, created_at)
                            VALUES (gen_random_uuid(), ${ciceroId}::uuid, ${zonaId}::uuid, NOW())
                            ON CONFLICT (seller_id, zona_id) DO NOTHING
                        `;
                        assigned++;
                    } catch (insertError: any) {
                        // Se falhar, tentar sem ON CONFLICT
                        try {
                            await prisma.$executeRaw`
                                INSERT INTO seller_zonas (id, seller_id, zona_id, created_at)
                                SELECT gen_random_uuid(), ${ciceroId}::uuid, ${zonaId}::uuid, NOW()
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM seller_zonas 
                                    WHERE seller_id = ${ciceroId}::uuid AND zona_id = ${zonaId}::uuid
                                )
                            `;
                            assigned++;
                        } catch (e: any) {
                            console.warn(`Erro ao atribuir zona ${zonaId} ao Cicero:`, e.message);
                        }
                    }
                }
            } catch (error: any) {
                console.warn('Erro ao atribuir zonas ao executivo:', error.message);
            }
        }

        // Sincronizar restaurantes com o executivo (atribuir restaurantes das novas zonas ao Cicero)
        if (ciceroId && createdZonaIds.length > 0) {
            try {
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
                    // Ignorar erro
                }

                if (columnExists) {
                    // Sincronizar restaurantes de TODAS as zonas de Sorocaba (não apenas as criadas)
                    for (const zonaId of todasZonasSorocabaIds) {
                        try {
                            const restaurants = await prisma.$queryRaw<Array<{ id: string }>>`
                                SELECT id FROM restaurants 
                                WHERE zona_id = ${zonaId}::uuid 
                                AND (seller_id IS NULL OR seller_id != ${ciceroId}::uuid)
                            `;
                            
                            for (const restaurant of restaurants) {
                                try {
                                    await prisma.$executeRaw`
                                        UPDATE restaurants 
                                        SET seller_id = ${ciceroId}::uuid,
                                            assigned_at = NOW()
                                        WHERE id = ${restaurant.id}::uuid
                                    `;
                                } catch (updateError: any) {
                                    console.warn(`Erro ao atualizar restaurante ${restaurant.id}:`, updateError.message);
                                }
                            }
                        } catch (e: any) {
                            console.warn(`Erro ao sincronizar restaurantes da zona ${zonaId}:`, e.message);
                        }
                    }
                }
            } catch (error: any) {
                console.warn('Erro ao sincronizar restaurantes:', error.message);
            }
        }

        revalidatePath('/admin/zonas');
        revalidatePath('/sellers');
        revalidatePath('/clients');
        revalidatePath('/carteira');

        let message = '';
        if (ciceroId) {
            if (assigned > 0) {
                message = `${created} zonas criadas, ${skipped} já existiam. ${assigned} zonas de Sorocaba atribuídas ao executivo Cicero.`;
            } else {
                message = `${created} zonas criadas, ${skipped} já existiam. As zonas de Sorocaba já estavam atribuídas ao executivo Cicero.`;
            }
        } else {
            message = `${created} zonas criadas, ${skipped} já existiam. ⚠️ Executivo Cicero não encontrado. Crie o executivo "Cicero" primeiro para atribuição automática.`;
        }

        return { 
            success: true, 
            created, 
            skipped,
            assigned,
            ciceroFound: !!ciceroId,
            message
        };
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao popular zonas de Sorocaba');
    }
}

// Função para encontrar zona por CEP
export async function findZonaByCep(cep: string): Promise<string | null> {
    try {
        const cleanedCep = cleanCep(cep);
        if (cleanedCep.length !== 8) {
            return null;
        }

        const cepNum = parseInt(cleanedCep, 10);

        // Garantir que a tabela existe
        await ensureTableExists();

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

        // Buscar zona que contém o CEP
        for (const zona of zonas) {
            // SQL retorna snake_case, modelo retorna camelCase
            const cepInicial = (zona as any).cepInicial || (zona as any).cep_inicial;
            const cepFinal = (zona as any).cepFinal || (zona as any).cep_final;
            const zonaInicio = parseInt(cleanCep(cepInicial), 10);
            const zonaFim = parseInt(cleanCep(cepFinal), 10);
            if (cepNum >= zonaInicio && cepNum <= zonaFim) {
                return (zona as any).id;
            }
        }

        return null;
    } catch (error) {
        console.error('Erro ao buscar zona por CEP:', error);
        return null;
    }
}
