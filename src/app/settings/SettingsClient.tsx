'use client';

import ImportExcelClient from './ImportExcelClient';
import ClearDataClient from './ClearDataClient';
import WhiteLabelClient from './WhiteLabelClient';
import ApiKeysClient from './ApiKeysClient';
import AIAgentsClient from './AIAgentsClient';
import LoginCustomizationClient from './LoginCustomizationClient';
import { PageLayout, Card, Grid } from '@/components/PageLayout';
import styles from './page.module.css';

export default function SettingsClient() {
    return (
        <PageLayout
            title="Configurações do Sistema"
            subtitle="Gerencie integrações, importação de dados e configurações do sistema"
            icon="⚙️"
        >
            {/* Seção de Identidade e Personalização */}
            <div className={styles.sectionGroup}>
                <h2 className={styles.sectionTitle}>🎨 Identidade e Personalização</h2>
                <Grid cols={2}>
                    <Card title="White Label">
                        <WhiteLabelClient />
                    </Card>
                    <Card title="Página de Login">
                        <LoginCustomizationClient />
                    </Card>
                </Grid>
            </div>

            {/* Seção de Integrações */}
            <div className={styles.sectionGroup}>
                <h2 className={styles.sectionTitle}>🔌 Integrações e API</h2>
                <Grid cols={2}>
                    <Card title="Chaves de API">
                        <ApiKeysClient />
                    </Card>
                    <Card title="Agentes de IA">
                        <AIAgentsClient />
                    </Card>
                </Grid>
            </div>

            {/* Seção de Dados */}
            <div className={styles.sectionGroup}>
                <h2 className={styles.sectionTitle}>📊 Gerenciamento de Dados</h2>
                <Grid cols={2}>
                    <Card title="Importação de Dados">
                        <ImportExcelClient />
                    </Card>
                    <Card title="Limpeza de Dados">
                        <ClearDataClient />
                    </Card>
                </Grid>
            </div>
        </PageLayout>
    );
}
