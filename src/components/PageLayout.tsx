'use client';

import { ReactNode } from 'react';
import styles from './PageLayout.module.css';
import { NotificationIcon } from './NotificationIcon';

interface PageLayoutProps {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    icon?: string;
    actions?: ReactNode;
    className?: string;
}

export function PageLayout({ children, title, subtitle, icon, actions, className }: PageLayoutProps) {
    return (
        <div className={`${styles.pageContainer} ${className || ''}`}>
            {(title || actions) && (
                <header className={styles.pageHeader}>
                    <div className={styles.headerContent}>
                        {title && (
                            <div className={styles.titleSection}>
                                {icon && <span className={styles.icon}>{icon}</span>}
                                <div>
                                    <h1 className={styles.title}>{title}</h1>
                                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.headerRight}>
                        <NotificationIcon />
                        {actions && <div className={styles.actions}>{actions}</div>}
                    </div>
                </header>
            )}
            <div className={styles.pageContent}>
                {children}
            </div>
        </div>
    );
}

export function Card({ children, className, title, actions }: { 
    children: ReactNode; 
    className?: string; 
    title?: string;
    actions?: ReactNode;
}) {
    return (
        <div className={`${styles.card} ${className || ''}`}>
            {(title || actions) && (
                <div className={styles.cardHeader}>
                    {title && <h3 className={styles.cardTitle}>{title}</h3>}
                    {actions && <div className={styles.cardActions}>{actions}</div>}
                </div>
            )}
            <div className={styles.cardBody}>
                {children}
            </div>
        </div>
    );
}

export function Grid({ children, cols = 3, className }: { 
    children: ReactNode; 
    cols?: number;
    className?: string;
}) {
    return (
        <div 
            className={`${styles.grid} ${className || ''}`}
            style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${300 / cols}px), 1fr))` }}
        >
            {children}
        </div>
    );
}

export function StatCard({ icon, label, value, trend, trendValue, color }: {
    icon: string;
    label: string;
    value: string | number;
    trend?: 'up' | 'down';
    trendValue?: string;
    color?: string;
}) {
    return (
        <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: color || 'var(--primary)' }}>
                <span>{icon}</span>
            </div>
            <div className={styles.statContent}>
                <div className={styles.statLabel}>{label}</div>
                <div className={styles.statValue}>{value}</div>
                {trend && trendValue && (
                    <div className={`${styles.statTrend} ${styles[trend]}`}>
                        <span>{trend === 'up' ? '↗' : '↘'}</span>
                        {trendValue}
                    </div>
                )}
            </div>
        </div>
    );
}

export function Badge({ children, variant = 'default' }: { 
    children: ReactNode; 
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
    return (
        <span className={`${styles.badge} ${styles[variant]}`}>
            {children}
        </span>
    );
}

export function Button({ children, variant = 'primary', onClick, disabled, className }: {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            className={`${styles.button} ${styles[variant]} ${className || ''}`}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

