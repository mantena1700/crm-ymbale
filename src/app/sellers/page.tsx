import { prisma } from '@/lib/db';
import SellersClient from './SellersClient';

export const dynamic = 'force-dynamic';

export default async function SellersPage() {
    try {
        // Buscar sellers com dados de território
        const sellers = await prisma.seller.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                photoUrl: true,
                active: true,
                territorioTipo: true,
                baseCidade: true,
                baseLatitude: true,
                baseLongitude: true,
                raioKm: true,
                territorioAtivo: true,
                areasCobertura: true
            }
        });

        // Mapear sellers com dados de território
        const sellersWithZonas = sellers.map(s => {
            // Garantir que areasCobertura seja um array válido ou null
            let areasCobertura: any = null;
            if (s.areasCobertura) {
                try {
                    // Se for string JSON, fazer parse
                    if (typeof s.areasCobertura === 'string') {
                        areasCobertura = JSON.parse(s.areasCobertura);
                    } else if (Array.isArray(s.areasCobertura)) {
                        areasCobertura = s.areasCobertura;
                    }
                } catch (e) {
                    areasCobertura = null;
                }
            }
            
            return {
                id: s.id,
                name: s.name,
                email: s.email || '',
                phone: s.phone || '',
                photoUrl: s.photoUrl || undefined,
                zonasIds: [], // Não usar mais zonas
                active: s.active || false,
                territorioTipo: s.territorioTipo,
                baseCidade: s.baseCidade,
                baseLatitude: s.baseLatitude ? Number(s.baseLatitude) : null,
                baseLongitude: s.baseLongitude ? Number(s.baseLongitude) : null,
                raioKm: s.raioKm,
                territorioAtivo: s.territorioAtivo !== null && s.territorioAtivo !== undefined ? s.territorioAtivo : true,
                areasCobertura: areasCobertura
            };
        });

        return <SellersClient 
            initialSellers={sellersWithZonas}
            availableZonas={[]}
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
                        <li><strong>Execute a migration do Prisma para criar as novas tabelas:</strong></li>
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
