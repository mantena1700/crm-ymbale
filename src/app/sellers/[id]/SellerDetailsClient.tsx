'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css'; // Reusing styles or I should create new ones? I'll assume I can reuse or inline for now.
// Actually, let's create a new CSS module for details if needed, but for now I'll use inline styles or standard classes if available.
// The user has `page.module.css` in `sellers`. I can probably reuse it if I import it, but it's better to have its own.
// Let's assume I can use standard HTML/CSS or create a simple layout.

interface Restaurant {
    id: string;
    name: string;
    address: any;
    status: string | null;
    salesPotential: string | null;
}

interface Seller {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    regions: any;
    neighborhoods: any;
    active: boolean | null;
    restaurants: Restaurant[];
}

export default function SellerDetailsClient({ seller }: { seller: Seller }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRestaurants = seller.restaurants.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.address?.city && r.address.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.address?.neighborhood && r.address.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/sellers" style={{ color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ← Voltar para Vendedores
                </Link>
            </div>

            <header style={{ marginBottom: '3rem', backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '0.5rem' }}>{seller.name}</h1>
                        <div style={{ display: 'flex', gap: '2rem', color: '#666' }}>
                            {seller.email && <span>📧 {seller.email}</span>}
                            {seller.phone && <span>📞 {seller.phone}</span>}
                        </div>
                    </div>
                    <span style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        backgroundColor: seller.active ? '#dcfce7' : '#f3f4f6',
                        color: seller.active ? '#166534' : '#4b5563',
                        fontWeight: '500'
                    }}>
                        {seller.active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '600' }}>Áreas de Cobertura</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(seller.regions as string[] || []).length > 0 ? (
                            (seller.regions as string[]).map((area, i) => (
                                <span key={i} style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.5rem 1rem', borderRadius: '15px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📍 {area}
                                </span>
                            ))
                        ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>Sem áreas de cobertura configuradas</span>
                        )}
                    </div>
                </div>
            </header>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Carteira de Clientes ({seller.restaurants.length})</h2>
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', width: '300px' }}
                    />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Nome</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Cidade/Bairro</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Potencial</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Status</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRestaurants.map(restaurant => (
                            <tr key={restaurant.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: '500' }}>{restaurant.name}</div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        {restaurant.address?.city || 'Cidade não informada'}
                                        {restaurant.address?.neighborhood && ` - ${restaurant.address.neighborhood}`}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '15px',
                                        fontSize: '0.75rem',
                                        backgroundColor: restaurant.salesPotential === 'Alto' ? '#dcfce7' : '#f3f4f6',
                                        color: restaurant.salesPotential === 'Alto' ? '#166534' : '#4b5563'
                                    }}>
                                        {restaurant.salesPotential || 'N/A'}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{ fontSize: '0.875rem' }}>{restaurant.status || 'A Analisar'}</span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <Link href={`/restaurant/${restaurant.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}>
                                        Ver Detalhes →
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {filteredRestaurants.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                                    Nenhum cliente encontrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
