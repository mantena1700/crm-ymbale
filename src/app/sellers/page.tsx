import { prisma } from '@/lib/db';
import SellersClient from './SellersClient';

export default async function SellersPage() {
    try {
        const sellers = await prisma.seller.findMany({
            orderBy: { name: 'asc' }
        });

        return <SellersClient initialSellers={sellers.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            photoUrl: s.photoUrl || undefined,
            regions: (s.regions as string[]) || [],
            neighborhoods: (s.neighborhoods as string[]) || [],
            active: s.active
        }))} />;
    } catch (error: any) {
        console.error('Erro ao carregar vendedores:', error);
        return (
            <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>❌ Erro ao carregar vendedores</h1>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                    {error.message || 'Erro desconhecido ao conectar com o banco de dados.'}
                </p>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        <strong>Possíveis soluções:</strong>
                    </p>
                    <ul style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                        <li>Verifique se a conexão com o banco de dados está configurada corretamente no arquivo .env.local</li>
                        <li>Certifique-se de que a tabela "sellers" existe no banco de dados</li>
                        <li>Execute: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>npx dotenv-cli -e .env.local -- npx prisma db push</code></li>
                    </ul>
                </div>
            </div>
        );
    }
}

