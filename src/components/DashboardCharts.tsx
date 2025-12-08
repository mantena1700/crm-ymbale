import styles from './DashboardCharts.module.css';

export default function DashboardCharts() {
    return (
        <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
                <h3>Projeção de Faturamento (Próx. 6 Meses)</h3>
                <div className={styles.barChart}>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '40%' }}></div>
                        <span>Jan</span>
                    </div>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '55%' }}></div>
                        <span>Fev</span>
                    </div>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '45%' }}></div>
                        <span>Mar</span>
                    </div>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '70%' }}></div>
                        <span>Abr</span>
                    </div>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '85%' }}></div>
                        <span>Mai</span>
                    </div>
                    <div className={styles.barGroup}>
                        <div className={styles.bar} style={{ height: '60%' }}></div>
                        <span>Jun</span>
                    </div>
                </div>
            </div>

            <div className={styles.chartCard}>
                <h3>Potencial por Categoria</h3>
                <div className={styles.pieChartContainer}>
                    <div className={styles.legend}>
                        <div className={styles.legendItem}>
                            <span className={styles.dot} style={{ background: 'var(--primary)' }}></span>
                            <span>Hamburgueria (45%)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.dot} style={{ background: 'var(--accent)' }}></span>
                            <span>Pizzaria (30%)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.dot} style={{ background: 'var(--secondary)' }}></span>
                            <span>Japonês (25%)</span>
                        </div>
                    </div>
                    <div className={styles.pieChart}></div>
                </div>
            </div>
        </div>
    );
}
