
import { prisma } from '@/lib/db';
import FixedClientsSection from '../FixedClientsSection';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getData() {
    try {
        // Buscar executivos ativos
        const sellers = await prisma.seller.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                email: true,
                active: true,
            },
            orderBy: { name: 'asc' }
        });

        // Buscar restaurantes básicos para seleção
        const restaurants = await prisma.restaurant.findMany({
            select: {
                id: true,
                name: true,
                address: true,
                sellerId: true
            },
            orderBy: { name: 'asc' }
        });

        return {
            sellers,
            restaurants: restaurants.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address ? JSON.parse(JSON.stringify(r.address)) : null,
                sellerId: r.sellerId
            }))
        };
    } catch (error) {
        console.error('Erro ao buscar dados para clientes fixos:', error);
        return {
            sellers: [],
            restaurants: []
        };
    }
}

export default async function FixedClientsPage() {
    const data = await getData();

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Link
                    href="/carteira"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        textDecoration: 'none',
                        color: '#666',
                        fontWeight: 500
                    }}
                >
                    ⬅️ Voltar para Carteira
                </Link>
            </div>

            <PageContent sellers={data.sellers} restaurants={data.restaurants} />
        </div>
    );
}

// Client wrapper to handle state
'use client';
import { useState } from 'react';

function PageContent({ sellers, restaurants }: { sellers: any[], restaurants: any[] }) {
    const [selectedSellerId, setSelectedSellerId] = useState<string>(sellers[0]?.id || '');

    return (
        <div>
            <div style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                marginBottom: '20px'
            }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', color: '#1f2937' }}>Gestão de Clientes Fixos</h1>
                <p style={{ margin: 0, color: '#6b7280' }}>Configure clientes recorrentes para o preenchimento inteligente da agenda.</p>

                <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500, color: '#374151' }}>Selecione o Executivo:</label>
                    <select
                        value={selectedSellerId}
                        onChange={(e) => setSelectedSellerId(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '1rem'
                        }}
                    >
                        {sellers.map(seller => (
                            <option key={seller.id} value={seller.id}>{seller.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <FixedClientsSection
                sellerId={selectedSellerId}
                restaurants={restaurants}
            />
        </div>
    );
}
