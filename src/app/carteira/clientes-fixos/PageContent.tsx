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
                background: '#1e293b',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid rgba(51, 65, 85, 0.5)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px'
            }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>Gestão de Clientes Fixos</h1>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.875rem' }}>Configure clientes recorrentes para o preenchimento inteligente da agenda.</p>

                <div style={{ marginTop: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#94a3b8', fontSize: '0.875rem' }}>Selecione o Executivo:</label>
                    <select
                        value={selectedSellerId}
                        onChange={(e) => setSelectedSellerId(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            fontSize: '0.875rem',
                            background: '#0f172a',
                            color: '#f8fafc',
                            outline: 'none',
                            cursor: 'pointer'
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
