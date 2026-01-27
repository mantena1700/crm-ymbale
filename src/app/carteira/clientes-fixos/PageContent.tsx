'use client';

import { useState } from 'react';
import FixedClientsSection from '../FixedClientsSection';

interface PageContentProps {
    sellers: any[];
    restaurants: any[];
}

export default function PageContent({ sellers, restaurants }: PageContentProps) {
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
