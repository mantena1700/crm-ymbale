'use client';

import { useState } from 'react';
import ImportExcelClient from './ImportExcelClient';
import ClearDataClient from './ClearDataClient';
import WhiteLabelClient from './WhiteLabelClient';
import styles from './page.module.css';

export default function SettingsClient() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>⚙️ Configurações do Sistema</h1>
                <p>Gerencie integrações, importação de dados e vendedores.</p>
            </header>

            <div className={styles.section}>
                <WhiteLabelClient />
            </div>

            <div className={styles.section}>
                <ClearDataClient />
            </div>

            <div className={styles.section}>
                <ImportExcelClient />
            </div>

            <div className={styles.section}>
                <h2>Integração IA</h2>
                <p className={styles.description}>
                    Configure suas chaves de API para ativar as funcionalidades de inteligência artificial.
                </p>
                
                <div className={styles.field}>
                    <label>Chave de API (OpenAI) - Principal</label>
                    <input 
                        type="text" 
                        value="Configurada no .env.local" 
                        disabled 
                        className={styles.input} 
                    />
                    <span className={`${styles.badge} ${styles.connected}`}>
                        ✅ Configurada
                    </span>
                    <p className={styles.helpText}>
                        A chave está configurada no arquivo .env.local. O sistema usa OpenAI GPT-4o-mini para análises avançadas, geração de emails e estratégias.
                    </p>
                </div>

                <div className={styles.field}>
                    <label>Chave de API (Gemini) - Backup</label>
                    <input type="password" value="AIzaSyDMhElgb9AuWmnGweVAPsl6EIUMBm8A0X4" disabled className={styles.input} />
                    <span className={`${styles.badge} ${styles.connected}`}>✅ Conectado</span>
                    <p className={styles.helpText}>
                        Usado como fallback quando OpenAI não está disponível.
                    </p>
                </div>

                <div className={styles.aiFeatures}>
                    <h3>Funcionalidades de IA Disponíveis:</h3>
                    <ul>
                        <li>✅ Análise inteligente de restaurantes</li>
                        <li>✅ Geração automática de emails personalizados</li>
                        <li>✅ Criação de estratégias de venda</li>
                        <li>✅ Mensagens de follow-up inteligentes</li>
                        <li>✅ Segmentação automática de clientes</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
