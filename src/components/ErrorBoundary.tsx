'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    maxWidth: '600px',
                    margin: '2rem auto'
                }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        ⚠️ Erro ao carregar página
                    </h2>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                        Ocorreu um erro ao carregar esta página. Por favor, tente recarregar.
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                        }}
                    >
                        🔄 Recarregar Página
                    </button>
                    {this.state.error && (
                        <details style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            background: '#f3f4f6',
                            borderRadius: '8px',
                            textAlign: 'left'
                        }}>
                            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                                Detalhes do erro
                            </summary>
                            <pre style={{
                                marginTop: '0.5rem',
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                overflow: 'auto'
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

