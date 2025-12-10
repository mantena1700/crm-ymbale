import { prisma } from '@/lib/db';
import SellersClient from './SellersClient';
import { seedZonasPadrao } from '@/app/admin/zonas/actions';

export const dynamic = 'force-dynamic';

export default async function SellersPage() {
    try {
        // Seed automático: verificar se há zonas e popular se necessário
        let zonasWereSeeded = false;
        try {
            // Tentar verificar se a tabela existe e contar zonas
            try {
                const zonasCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
                    SELECT COUNT(*) as count FROM zonas_cep
                `;
                const count = Number(zonasCount[0]?.count || 0);
                
                if (count === 0) {
                    console.log('🌱 Nenhuma zona encontrada na página de executivos. Populando zonas pré-cadastradas automaticamente...');
                    const seedResult = await seedZonasPadrao();
                    zonasWereSeeded = true;
                    console.log('✅ Zonas pré-cadastradas populadas com sucesso!', seedResult);
                } else {
                    console.log(`✅ ${count} zonas já existem no banco de dados`);
                }
            } catch (countError: any) {
                // Se não conseguir contar, tentar popular diretamente
                if (countError.code === '42P01' || countError.message?.includes('does not exist') || countError.message?.includes('relation')) {
                    console.log('📋 Tabela zonas_cep não existe na página de executivos. Criando e populando...');
                    try {
                        const seedResult = await seedZonasPadrao();
                        zonasWereSeeded = true;
                        console.log('✅ Tabela criada e zonas populadas!', seedResult);
                    } catch (seedError: any) {
                        console.warn('⚠️ Erro ao popular zonas automaticamente:', seedError.message);
                    }
                } else {
                    console.warn('⚠️ Erro ao contar zonas:', countError.message);
                }
            }
        } catch (error: any) {
            console.warn('⚠️ Erro ao verificar/popular zonas na página de executivos:', error.message);
        }
        // Função helper para verificar se modelo existe
        const hasModel = (modelName: string): boolean => {
            try {
                return prisma && typeof (prisma as any)[modelName] !== 'undefined';
            } catch {
                return false;
            }
        };

        // Verificar modelos disponíveis
        const hasZonaModel = hasModel('zonaCep');
        const hasSellerZonaModel = hasModel('sellerZona');

        // Buscar sellers
        const sellers = await prisma.seller.findMany({
            orderBy: { name: 'asc' }
        });

        // Buscar zonas de cada seller separadamente via SQL direto
        const sellerZonasMap = new Map<string, string[]>();
        try {
            // Verificar se a tabela existe
            await prisma.$queryRaw`SELECT 1 FROM seller_zonas LIMIT 1`;
            
            // Buscar todas as relações seller-zona
            const sellerZonas = await prisma.$queryRaw<Array<{
                seller_id: string;
                zona_id: string;
            }>>`
                SELECT seller_id, zona_id FROM seller_zonas
            `;
            
            // Agrupar zonas por seller
            sellerZonas.forEach(sz => {
                const current = sellerZonasMap.get(sz.seller_id) || [];
                if (!current.includes(sz.zona_id)) {
                    sellerZonasMap.set(sz.seller_id, [...current, sz.zona_id]);
                }
            });
            
            // Debug: verificar quantas zonas foram encontradas
            console.log(`Zonas carregadas: ${sellerZonas.length} relações encontradas`);
            sellers.forEach(s => {
                const zonas = sellerZonasMap.get(s.id) || [];
                if (zonas.length > 0) {
                    console.log(`Seller ${s.name}: ${zonas.length} zonas`);
                }
            });
        } catch (error: any) {
            // Se a tabela não existir, tentar buscar via Prisma se disponível
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
                console.warn('Tabela seller_zonas não existe ainda. As zonas não serão carregadas.');
            } else {
                console.warn('Erro ao buscar zonas dos sellers:', error.message);
            }
            
            // Tentar buscar via Prisma como fallback
            if (hasZonaModel && hasSellerZonaModel) {
                try {
                    const sellersWithZonas = await prisma.seller.findMany({
                        include: {
                            zonas: {
                                include: {
                                    zona: true
                                }
                            }
                        },
                        orderBy: { name: 'asc' }
                    });
                    
                    sellersWithZonas.forEach(s => {
                        if (s.zonas && Array.isArray(s.zonas)) {
                            const zonasIds = s.zonas.map((sz: any) => sz.zonaId || sz.zona_id);
                            sellerZonasMap.set(s.id, zonasIds);
                        }
                    });
                } catch (prismaError: any) {
                    console.warn('Erro ao buscar zonas via Prisma:', prismaError.message);
                }
            }
        }

        // Buscar zonas disponíveis (sempre usar SQL direto para garantir compatibilidade)
        // IMPORTANTE: Buscar DEPOIS do seed para garantir que as zonas criadas sejam encontradas
        let zonas: any[] = [];
        
        // Se fez seed, dar um pequeno delay para garantir que o banco processou
        if (zonasWereSeeded) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        try {
            // Buscar TODAS as zonas primeiro (sem filtro de ativo para debug)
            const resultAll = await prisma.$queryRaw<Array<{
                id: string;
                zona_nome: string;
                cep_inicial: string;
                cep_final: string;
                regiao?: string;
                ativo: boolean;
            }>>`SELECT * FROM zonas_cep ORDER BY regiao ASC NULLS LAST, zona_nome ASC`;
            
            console.log(`📊 Total de zonas no banco (todas): ${resultAll.length}`);
            
            // Filtrar apenas as ativas
            const result = resultAll.filter(z => z.ativo === true);
            
            zonas = result.map(z => ({
                id: z.id,
                zonaNome: z.zona_nome,
                cepInicial: z.cep_inicial,
                cepFinal: z.cep_final,
                regiao: (z as any).regiao || null,
                ativo: z.ativo
            }));
            
            console.log(`✅ Zonas ativas encontradas: ${zonas.length}`);
            
            // Se não encontrou zonas ativas mas encontrou zonas inativas, logar
            if (zonas.length === 0 && resultAll.length > 0) {
                console.warn(`⚠️ Encontradas ${resultAll.length} zonas, mas todas estão inativas!`);
            }
        } catch (error: any) {
            // Se a tabela não existir, tentar criar ou usar array vazio
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
                console.warn('⚠️ Tabela zonas_cep não existe ainda. Execute: npx prisma db push');
                zonas = [];
            } else {
                console.warn('⚠️ Erro ao buscar zonas:', error.message);
                zonas = [];
            }
        }
        
        // Log apenas se realmente não encontrou zonas (não quebrar a aplicação)
        if (zonas.length === 0) {
            console.log('⚠️ Nenhuma zona ativa encontrada. A página continuará funcionando normalmente.');
        }

        // Mapear sellers com suas zonas garantindo que zonasIds seja sempre um array
        const sellersWithZonas = sellers.map(s => {
            const zonasIds = sellerZonasMap.get(s.id) || [];
            return {
                id: s.id,
                name: s.name,
                email: s.email || '',
                phone: s.phone || '',
                photoUrl: s.photoUrl || undefined,
                zonasIds: Array.isArray(zonasIds) ? zonasIds : [],
                active: s.active
            };
        });
        
        // Debug: verificar se as zonas estão sendo passadas
        console.log('Sellers com zonas:', sellersWithZonas.map(s => ({
            name: s.name,
            zonasCount: s.zonasIds.length
        })));

        // Preparar zonas para passar ao componente
        const zonasParaComponente = zonas.map(z => ({
            id: z.id,
            zonaNome: z.zonaNome,
            cepInicial: z.cepInicial,
            cepFinal: z.cepFinal,
            regiao: z.regiao
        }));

        console.log('🔍 DEBUG FINAL - Zonas sendo passadas para SellersClient:', {
            total: zonasParaComponente.length,
            zonas: zonasParaComponente.map(z => ({ id: z.id, nome: z.zonaNome, regiao: z.regiao }))
        });

        if (zonasParaComponente.length === 0) {
            console.warn('⚠️ AVISO: Nenhuma zona encontrada. Verifique se o seed foi executado corretamente.');
        }

        return <SellersClient 
            initialSellers={sellersWithZonas}
            availableZonas={zonasParaComponente}
        />;
    } catch (error: any) {
        console.error('Erro ao carregar executivos:', error);
        return (
            <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>❌ Erro ao carregar executivos</h1>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                    {error.message || 'Erro desconhecido ao conectar com o banco de dados.'}
                </p>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        <strong>Possíveis soluções:</strong>
                    </p>
                    <ul style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                        <li>Verifique se a conexão com o banco de dados está configurada corretamente no arquivo .env.local</li>
                        <li>Certifique-se de que as tabelas existem no banco de dados</li>
                        <li><strong>Execute a migration do Prisma para criar as novas tabelas de zonas:</strong></li>
                        <li style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                            <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>npx prisma db push</code>
                        </li>
                        <li style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                            Ou: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>npx prisma migrate dev</code>
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

