'use client';

import styles from './ReportButton.module.css';

export default function ReportButton() {
    return (
        <button className={styles.button} onClick={() => window.print()}>
            📄 Gerar Relatório PDF
        </button>
    );
}
