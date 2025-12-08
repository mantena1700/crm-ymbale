'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function InsightsPage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>💡 Insights IA</h1>
                <p>Análises inteligentes geradas automaticamente</p>
            </header>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <div className={styles.cardIcon}>📊</div>
                    <h3>Análise de Pipeline</h3>
                    <p>Veja insights sobre seu funil de vendas e oportunidades de melhoria.</p>
                    <Link href="/reports" className={styles.cardLink}>
                        Ver Relatórios →
                    </Link>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardIcon}>🎯</div>
                    <h3>Leads Prioritários</h3>
                    <p>Identifique os leads com maior potencial de conversão.</p>
                    <Link href="/pipeline" className={styles.cardLink}>
                        Ver Pipeline →
                    </Link>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardIcon}>📈</div>
                    <h3>Tendências</h3>
                    <p>Acompanhe tendências de mercado e comportamento dos clientes.</p>
                    <Link href="/reports" className={styles.cardLink}>
                        Ver Análises →
                    </Link>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardIcon}>🤖</div>
                    <h3>Análise em Lote</h3>
                    <p>Analise múltiplos restaurantes de uma vez com IA.</p>
                    <Link href="/batch-analysis" className={styles.cardLink}>
                        Iniciar Análise →
                    </Link>
                </div>
            </div>
        </div>
    );
}

