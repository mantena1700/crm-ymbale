'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionCode, ROLE_PERMISSIONS } from '@/lib/permissions';

interface PermissionGuardProps {
    permission: PermissionCode | PermissionCode[];
    children: ReactNode;
    fallback?: ReactNode;
    requireAll?: boolean; // Se true, precisa de TODAS as permissões; se false, precisa de pelo menos uma
}

export default function PermissionGuard({ 
    permission, 
    children, 
    fallback = null,
    requireAll = false 
}: PermissionGuardProps) {
    const { user } = useAuth();
    const [hasAccess, setHasAccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setHasAccess(false);
            setLoading(false);
            return;
        }

        // Admin tem todas as permissões
        if (user.role === 'admin') {
            setHasAccess(true);
            setLoading(false);
            return;
        }

        const permissions = Array.isArray(permission) ? permission : [permission];
        const userPermissions = ROLE_PERMISSIONS[user.role] || [];

        if (requireAll) {
            // Precisa de todas as permissões
            setHasAccess(permissions.every(p => userPermissions.includes(p)));
        } else {
            // Precisa de pelo menos uma
            setHasAccess(permissions.some(p => userPermissions.includes(p)));
        }
        
        setLoading(false);
    }, [user, permission, requireAll]);

    if (loading) return null;
    if (!hasAccess) return <>{fallback}</>;
    return <>{children}</>;
}

// Hook para usar em componentes
export function usePermission(permission: PermissionCode | PermissionCode[], requireAll = false): boolean {
    const { user } = useAuth();
    
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permissions = Array.isArray(permission) ? permission : [permission];
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];

    if (requireAll) {
        return permissions.every(p => userPermissions.includes(p));
    }
    return permissions.some(p => userPermissions.includes(p));
}

// Componente para mostrar conteúdo apenas para admin
export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
    const { user } = useAuth();
    
    if (!user || user.role !== 'admin') return <>{fallback}</>;
    return <>{children}</>;
}
