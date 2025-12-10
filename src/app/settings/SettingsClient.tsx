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
            <Grid cols={1}>
                <Card title="🎨 White Label">
                    <WhiteLabelClient />
                </Card>

                <Card title="🔐 Personalização da Página de Login">
                    <LoginCustomizationClient />
                </Card>

                <Card title="🔑 Chaves de API">
                    <ApiKeysClient />
                </Card>

                <Card title="🤖 Agentes de IA">
                    <AIAgentsClient />
                </Card>

                <Card title="🗑️ Limpeza de Dados">
                    <ClearDataClient />
                </Card>

                <Card title="📊 Importação de Dados">
                    <ImportExcelClient />
                </Card>
            </Grid>
        </PageLayout>
    );
}
