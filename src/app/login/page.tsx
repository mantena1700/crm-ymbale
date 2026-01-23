'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface LoginSettings {
    loginTitle: string | null;
    loginSubtitle: string | null;
    loginMessage: string | null;
    loginShowMessage: boolean;
    loginBackgroundColor: string | null;
    loginLogo: string | null;
    crmName: string;
    crmLogo: string | null;
}

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginSettings, setLoginSettings] = useState<LoginSettings | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/system-settings')
            .then(res => res.json())
            .then(data => {
                console.log('🔍 Configurações recebidas na página de login:', data);
                setLoginSettings({
                    loginTitle: data.loginTitle,
                    loginSubtitle: data.loginSubtitle,
                    loginMessage: data.loginMessage,
                    loginShowMessage: data.loginShowMessage || false,
                    loginBackgroundColor: data.loginBackgroundColor,
                    loginLogo: data.loginLogo,
                    crmName: data.crmName || 'DOM Seven',
                    crmLogo: data.crmLogo,
                });
            })
            .catch((error) => {
                console.error('❌ Erro ao buscar configurações:', error);
                setLoginSettings({
                    loginTitle: null,
                    loginSubtitle: null,
                    loginMessage: null,
                    loginShowMessage: false,
                    loginBackgroundColor: null,
                    loginLogo: null,
                    crmName: 'DOM Seven',
                    crmLogo: null,
                });
            });
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                router.push('/');
                router.refresh();
            } else {
                setError(data.error || 'Erro ao fazer login');
            }
        } catch (err) {
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const bgColor = loginSettings?.loginBackgroundColor || undefined;
    const title = loginSettings?.loginTitle || loginSettings?.crmName || 'DOM Seven';
    const subtitle = loginSettings?.loginSubtitle || 'Sistema de Gestão Comercial';
    const logoUrl = loginSettings?.loginLogo || loginSettings?.crmLogo;
    const showMessage = loginSettings?.loginShowMessage && loginSettings?.loginMessage;

    return (
        <div
            className={styles.container}
            style={bgColor ? { background: bgColor } : undefined}
        >
            <div className={styles.background}>
                <div className={styles.shape}></div>
                <div className={styles.shape}></div>
            </div>

            <div className={styles.loginCard}>
                <div className={styles.logoSection}>
                    <div className={styles.logo}>
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={title}
                                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                            />
                        ) : (
                            <span className={styles.logoIcon}>📦</span>
                        )}
                        <h1>{title}</h1>
                    </div>
                    <p className={styles.subtitle}>{subtitle}</p>
                </div>

                {showMessage && loginSettings?.loginMessage && (
                    <div style={{
                        padding: '12px 16px',
                        marginBottom: '20px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '12px',
                        color: '#a5b4fc',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {loginSettings.loginMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <h2>Entrar</h2>

                    {error && (
                        <div className={styles.error}>
                            <span>⚠️</span>
                            {error}
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label htmlFor="username">Usuário</label>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>👤</span>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Digite seu usuário"
                                required
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">Senha</label>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>🔒</span>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Digite sua senha"
                                required
                                autoComplete="current-password"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className={styles.spinner}></span>
                                Entrando...
                            </>
                        ) : (
                            <>
                                Entrar
                                <span className={styles.arrow}>→</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

