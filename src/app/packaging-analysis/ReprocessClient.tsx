'use client';

import { useState } from 'react';
import { reprocessAllRestaurants } from '@/lib/actions/packaging-analysis';

export default function ReprocessClient() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleReprocess = async () => {
        if (!confirm('Tem certeza que deseja reprocessar TODA a base? Isso pode levar alguns segundos.')) return;

        setLoading(true);
        try {
            const res = await reprocessAllRestaurants();
            setResult(res);
        } catch (error) {
            console.error(error);
            alert('Erro ao reprocessar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '20px' }}>Reprocessar Base de Dados</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>
                Esta ferramenta irá analisar todos os restaurantes da base novamente, buscando problemas de embalagem nos comentários
                e atualizando a classificação (Diamante, Alta Prioridade, etc) automaticamente.
            </p>

            <button
                onClick={handleReprocess}
                disabled={loading}
                style={{
                    padding: '12px 24px',
                    backgroundColor: loading ? '#ccc' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                {loading ? 'Reprocessando...' : 'Iniciar Análise Completa'}
            </button>

            {result && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <h3 style={{ color: '#166534', marginBottom: '10px' }}>Sucesso!</h3>
                    <p>Total de restaurantes processados: <strong>{result.total}</strong></p>
                    <p>Restaurantes com problemas identificados: <strong>{result.count}</strong></p>
                </div>
            )}
        </div>
    );
}
