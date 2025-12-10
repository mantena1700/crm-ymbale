'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import ChangePasswordModal from './ChangePasswordModal';
import { ErrorBoundary } from './ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const { user, mustChangePassword, onPasswordChanged, loading } = useAuth();
    
    // Páginas que não devem mostrar o layout completo (sidebar, etc)
    const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

    if (isAuthPage) {
        // Layout limpo para páginas de autenticação
        return (
            <ErrorBoundary>
                <div className="auth-layout">
                    {children}
                    <ThemeToggle />
                </div>
            </ErrorBoundary>
        );
    }

    // Layout completo com sidebar para páginas autenticadas
    return (
        <ErrorBoundary>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
                <ThemeToggle />
                
                {/* Modal de troca de senha obrigatória */}
                {!loading && user && mustChangePassword && (
                    <ChangePasswordModal 
                        userId={user.id} 
                        onSuccess={onPasswordChanged}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
}

