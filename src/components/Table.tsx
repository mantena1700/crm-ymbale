'use client';

import { ReactNode } from 'react';
import styles from './Table.module.css';

interface Column {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render?: (value: any, row: any) => ReactNode;
}

interface TableProps {
    columns: Column[];
    data: any[];
    onRowClick?: (row: any) => void;
    emptyMessage?: string;
    isLoading?: boolean;
}

export function Table({ columns, data, onRowClick, emptyMessage = 'Nenhum dado encontrado', isLoading }: TableProps) {
    if (isLoading) {
        return (
            <div className={styles.tableWrapper}>
                <div className={styles.loadingState}>
                    <span className={styles.spinner}>⏳</span>
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className={styles.tableWrapper}>
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📭</span>
                    <p>{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <div className={styles.tableScroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th 
                                    key={col.key}
                                    style={{ 
                                        width: col.width,
                                        textAlign: col.align || 'left'
                                    }}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr 
                                key={row.id || index}
                                onClick={() => onRowClick?.(row)}
                                className={onRowClick ? styles.clickable : ''}
                            >
                                {columns.map(col => (
                                    <td 
                                        key={col.key}
                                        style={{ textAlign: col.align || 'left' }}
                                    >
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

interface FormFieldProps {
    label: string;
    children: ReactNode;
    error?: string;
    required?: boolean;
    hint?: string;
}

export function FormField({ label, children, error, required, hint }: FormFieldProps) {
    return (
        <div className={styles.formField}>
            <label className={styles.formLabel}>
                {label}
                {required && <span className={styles.required}>*</span>}
            </label>
            {children}
            {hint && <p className={styles.formHint}>{hint}</p>}
            {error && <p className={styles.formError}>{error}</p>}
        </div>
    );
}

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input className={styles.input} {...props} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select className={styles.select} {...props}>{children}</select>;
}

export function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea className={styles.textarea} {...props} />;
}

