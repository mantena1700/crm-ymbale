'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: string;
    username: string;
    name: string;
    email: string | null;
    role: 'admin' | 'user';
    mustChangePassword?: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    mustChangePassword: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    onPasswordChanged: () => void;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Verificar sessão ao carregar
    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const response = await fetch('/api/auth/session');
            const data = await response.json();

            if (data.authenticated) {
                setUser(data.user);
                setMustChangePassword(data.mustChangePassword || false);
            } else {
                setUser(null);
                setMustChangePassword(false);
                // Redirecionar para login se não estiver na página de login
                if (pathname !== '/login') {
                    router.push('/login');
                }
            }
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
            setUser(null);
            setMustChangePassword(false);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                setUser(data.user);
                setMustChangePassword(data.mustChangePassword || false);
                router.push('/');
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Erro de conexão. Tente novamente.' };
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Erro no logout:', error);
        } finally {
            setUser(null);
            setMustChangePassword(false);
            router.push('/login');
        }
    };

    const onPasswordChanged = () => {
        setMustChangePassword(false);
        if (user) {
            setUser({ ...user, mustChangePassword: false });
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            mustChangePassword,
            login,
            logout,
            onPasswordChanged,
            isAdmin: user?.role === 'admin'
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

