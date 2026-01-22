'use client';

import { useEffect, useState } from 'react';

export default function AttributionMapClient({ sellers, restaurants }: any) {
    const [hasGoogleMapsKey, setHasGoogleMapsKey] = useState(false);

    useEffect(() => {
        // Verificar se há chave do Google Maps configurada
        const checkGoogleMapsKey = async () => {
            try {
                const response = await fetch('/api/google-maps-key');
                const data = await response.json();
                setHasGoogleMapsKey(!!data.apiKey && data.apiKey !== '');
            } catch (error) {
                setHasGoogleMapsKey(false);
            }
        };
        checkGoogleMapsKey();
    }, []);

    if (!hasGoogleMapsKey) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                maxWidth: '600px',
                margin: '40px auto',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px'
            }}>
                <h2 style={{ color: '#856404', marginBottom: '16px' }}>
                    ⚠️ Google Maps não configurado
                </h2>
                <p style={{ color: '#856404', marginBottom: '24px' }}>
                    Para usar a visualização de atribuição geográfica, é necessário configurar uma chave válida do Google Maps API com cobrança habilitada.
                </p>
                <div style={{
                    backgroundColor: '#fff',
                    padding: '20px',
                    borderRadius: '4px',
                    textAlign: 'left',
                    marginBottom: '20px'
                }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Como configurar:</h3>
                    <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                        <li>Acesse o Google Cloud Console</li>
                        <li>Crie ou selecione um projeto</li>
                        <li>Habilite a API do Google Maps JavaScript</li>
                        <li>Configure uma conta de cobrança</li>
                        <li>Copie a chave da API</li>
                        <li>Configure em Configurações → Google Maps API Key</li>
                    </ol>
                </div>
                <p style={{ fontSize: '14px', color: '#666' }}>
                    <strong>Dados disponíveis:</strong><br />
                    {sellers.length} executivos cadastrados<br />
                    {restaurants.length} clientes com coordenadas
                </p>
            </div>
        );
    }

    // Se tiver a chave, carregar o componente do mapa
    // (código original do mapa aqui)
    return (
        <div style={{ padding: '20px' }}>
            <p>Carregando mapa...</p>
        </div>
    );
}
