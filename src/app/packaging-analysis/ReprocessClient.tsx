'use client';

import { useState } from 'react';
import { reprocessAllRestaurants } from '@/lib/actions/packaging-analysis';
import { PageLayout, Card, Button } from '@/components/PageLayout';

export default function ReprocessClient() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const handleReprocess = async () => {
        if (!confirm('Tem certeza que deseja reprocessar TODA a base? Isso irá varrer todos os comentários em busca de problemas de embalagem.')) return;

        setLoading(true);
        setLogs(['🚀 Iniciando varredura da base de dados...', '🔍 Buscando padrões: vazamento, temperatura, embalagem frágil...']);
        setResult(null);

        try {
            // Em aplicação real com muitos dados, idealmente isso seria feito em chunks ou streaming
            // Como é uma server action, o tempo pode exceder o limite do Vercel (10s no plano free)
            // Se estiver em VPS, o timeout é maior.

            const res = await reprocessAllRestaurants();

            setResult(res);
            addLog(`✅ Processamento concluído!`);
            addLog(`📊 Total analisado: ${res.total}`);
            addLog(`⚠️ Problemas encontrados: ${res.count}`);

            if (res.count > 0) {
                addLog('💎 Os leads críticos foram atualizados para prioridade DIAMANTE/OURO.');
            }

        } catch (error: any) {
            console.error(error);
            addLog('❌ Erro ao reprocessar: ' + (error.message || 'Erro desconhecido'));
            addLog('⚠️ Se a base for muito grande, tente analisar por partes (funcionalidade futura).');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout
            title="Análise de Embalagens (Legado)"
            subtitle="Reprocesse sua base antiga para encontrar oportunidades ocultas"
            icon="📦"
        >
            <Card>
                <div style={{ maxWidth: '600px' }}>
                    <h3 style={{ marginBottom: '15px', color: '#1e293b' }}>Como funciona?</h3>
                    <p style={{ marginBottom: '10px', color: '#64748b', lineHeight: '1.6' }}>
                        Esta ferramenta varre <strong>toda a sua base de clientes importada</strong> (mesmo os antigos).
                        Ela lê os comentários de cada restaurante procurando palavras-chave específicas como:
                    </p>
                    <ul style={{ marginBottom: '20px', color: '#64748b', paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li>🔴 "Vazou", "Derramou", "Molhou" (Crítico)</li>
                        <li>🔵 "Frio", "Gelado", "Temperatura"</li>
                        <li>🟡 "Amassado", "Revirado", "Embalagem fraca"</li>
                    </ul>
                    <p style={{ marginBottom: '25px', color: '#64748b' }}>
                        Se encontrar problemas, o sistema atualizará automaticamente a prioridade do lead para <strong>DIAMANTE 💎</strong> ou <strong>OURO 🏆</strong>, movendo-o para o topo da lista.
                    </p>

                    <Button
                        onClick={handleReprocess}
                        disabled={loading}
                        variant={loading ? 'secondary' : 'primary'}
                        style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '15px' }}
                    >
                        {loading ? '⚡ Processando Base de Dados...' : '🚀 Iniciar Varredura Completa'}
                    </Button>
                </div>
            </Card>

            {(logs.length > 0 || result) && (
                <Card title="Log de Execução">
                    <div style={{
                        backgroundColor: '#1e293b',
                        color: '#10b981',
                        padding: '15px',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        height: '300px',
                        overflowY: 'auto'
                    }}>
                        {logs.map((log, i) => (
                            <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b', marginRight: '10px' }}>{new Date().toLocaleTimeString()}</span>
                                {log}
                            </div>
                        ))}
                        {loading && (
                            <div style={{ marginTop: '10px', color: '#fbbf24' }}>
                                ⏳ Processando... Por favor, não feche esta página.
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </PageLayout>
    );
}
