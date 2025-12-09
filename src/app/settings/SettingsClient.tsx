'use client';

import ImportExcelClient from './ImportExcelClient';
import ClearDataClient from './ClearDataClient';
import WhiteLabelClient from './WhiteLabelClient';
import ApiKeysClient from './ApiKeysClient';
import AIAgentsClient from './AIAgentsClient';
import styles from './page.module.css';

export default function SettingsClient() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>⚙️ Configurações do Sistema</h1>
                <p>Gerencie integrações, importação de dados e configurações.</p>
            </header>

            <div className={styles.section}>
                <WhiteLabelClient />
            </div>

            <div className={styles.section}>
                <ApiKeysClient />
            </div>

            <div className={styles.section}>
                <AIAgentsClient />
            </div>

            <div className={styles.section}>
                <ClearDataClient />
            </div>

            <div className={styles.section}>
                <ImportExcelClient />
            </div>
        </div>
    );
}
