import { prisma } from '@/lib/db';
import ZonasClient from './ZonasClient';
import { PageLayout } from '@/components/PageLayout';
import { seedZonasPadrao } from './actions';

export const dynamic = 'force-dynamic';

export default async function ZonasPage() {
    try {
        // Seed automático: verificar se há zonas e popular se necessário
        try {
            const zonasCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM zonas_cep
            `;
            const count = Number(zonasCount[0]?.count || 0);
            
            if (count === 0) {
                console.log('🌱 Nenhuma zona encontrada. Populando zonas pré-cadastradas automaticamente...');
                await seedZonasPadrao();
                console.log('✅ Zonas pré-cadastradas populadas com sucesso!');
            }
        } catch (error: any) {
            // Se a tabela não existir, tentar criar e popular
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
                console.log('📋 Tabela zonas_cep não existe. Criando e populando...');
                try {
                    await seedZonasPadrao();
                    console.log('✅ Tabela criada e zonas populadas!');
                } catch (seedError: any) {
                    console.warn('⚠️ Erro ao popular zonas automaticamente:', seedError.message);
                }
            } else {
                console.warn('⚠️ Erro ao verificar zonas:', error.message);
            }
        }
        // Buscar zonas (usar modelo se disponível, senão SQL direto)
        let zonas: any[] = [];
        
        try {
            if (prisma && typeof (prisma as any).zonaCep !== 'undefined') {
                zonas = await (prisma as any).zonaCep.findMany({
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
                    regiao?: string;
                    ativo: boolean;
                }>>`
                    SELECT * FROM zonas_cep 
                    ORDER BY ativo DESC, zona_nome ASC
                `;
                zonas = result.map(z => ({
                    id: z.id,
                    zonaNome: z.zona_nome,
                    cepInicial: z.cep_inicial,
                    cepFinal: z.cep_final,
                    regiao: (z as any).regiao,
                    ativo: z.ativo
                }));
            }
        } catch (error: any) {
            // Se a tabela não existir, usar array vazio
            if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
                console.warn('Tabela zonas_cep não existe ainda. Execute: npx prisma db push');
                zonas = [];
            } else {
                console.error('Erro ao buscar zonas:', error);
                zonas = [];
            }
        }

        return (
            <PageLayout
                title="🗺️ Gerenciar Zonas"
                subtitle="Configure as zonas geográficas baseadas em ranges de CEP"
            >
                <ZonasClient initialZonas={zonas.map(z => ({
                    id: (z as any).id,
                    zonaNome: (z as any).zonaNome || (z as any).zona_nome,
                    cepInicial: (z as any).cepInicial || (z as any).cep_inicial,
                    cepFinal: (z as any).cepFinal || (z as any).cep_final,
                    regiao: (z as any).regiao || (z as any).regiao,
                    ativo: (z as any).ativo !== undefined ? (z as any).ativo : true
                }))} />
            </PageLayout>
        );
    } catch (error: any) {
        console.error('Erro ao carregar zonas:', error);
        return (
            <PageLayout title="❌ Erro">
                <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Erro ao carregar zonas</h2>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                        {error.message || 'Erro desconhecido ao conectar com o banco de dados.'}
                    </p>
                    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                            <strong>Possíveis soluções:</strong>
                        </p>
                        <ul style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                            <li>Execute: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>npx prisma generate</code></li>
                            <li>Depois: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>npx prisma db push</code></li>
                            <li>Reinicie o servidor Next.js</li>
                        </ul>
                    </div>
                </div>
            </PageLayout>
        );
    }
}
