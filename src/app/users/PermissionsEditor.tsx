'use client';

import { useState, useEffect } from 'react';
import { getUserPermissionsById, updateUserPermissions, updateUserRole } from './permissions-actions';
import { ALL_PERMISSIONS, PermissionCode, ROLE_PERMISSIONS } from '@/lib/permissions';
import styles from './page.module.css';

interface PermissionsEditorProps {
    userId: string;
    userName: string;
    userRole: string;
    currentUserRole: 'admin' | 'user'; // Role of the user making the edit
    onClose: () => void;
    onSave: () => void;
}

// Agrupar permissões por módulo
const PERMISSION_GROUPS: Record<string, { label: string; icon: string; permissions: PermissionCode[] }> = {
    dashboard: {
        label: 'Dashboard',
        icon: '📊',
        permissions: ['dashboard.view']
    },
    clients: {
        label: 'Clientes',
        icon: '👥',
        permissions: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete']
    },
    pipeline: {
        label: 'Pipeline',
        icon: '🚀',
        permissions: ['pipeline.view', 'pipeline.edit']
    },
    agenda: {
        label: 'Agenda',
        icon: '📅',
        permissions: ['agenda.view', 'agenda.create', 'agenda.edit', 'agenda.delete']
    },
    sellers: {
        label: 'Executivos',
        icon: '👔',
        permissions: ['sellers.view', 'sellers.create', 'sellers.edit', 'sellers.delete']
    },
    campaigns: {
        label: 'Campanhas',
        icon: '📣',
        permissions: ['campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.delete']
    },
    reports: {
        label: 'Relatórios',
        icon: '📄',
        permissions: ['reports.view']
    },
    analysis: {
        label: 'Análise IA',
        icon: '🤖',
        permissions: ['analysis.view', 'analysis.execute']
    },
    goals: {
        label: 'Metas',
        icon: '🎯',
        permissions: ['goals.view', 'goals.create', 'goals.edit']
    },
    settings: {
        label: 'Configurações',
        icon: '⚙️',
        permissions: ['settings.view', 'settings.edit']
    },
    users: {
        label: 'Usuários',
        icon: '🔐',
        permissions: ['users.view', 'users.create', 'users.edit', 'users.delete']
    }
};

// Permissões que usuários comuns (não-admins) NÃO podem ver nem atribuir
const RESTRICTED_FOR_NON_ADMINS = [
    'sellers.delete',              // Excluir Executivos
    'campaigns.create',            // Criar Campanhas
    'campaigns.edit',              // Editar Campanhas
    'campaigns.delete',            // Excluir Campanhas
    'settings.view',               // Ver Configurações
    'settings.edit',               // Editar Configurações
    'users.edit',                  // Editar Usuários
    'users.delete'                 // Excluir Usuários
];

export default function PermissionsEditor({ userId, userName, userRole, currentUserRole, onClose, onSave }: PermissionsEditorProps) {
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
    const [role, setRole] = useState(userRole);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadPermissions();
    }, [userId]);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const perms = await getUserPermissionsById(userId);
            setSelectedPermissions(new Set(perms));
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePermission = (code: string) => {
        if (role === 'admin') return; // Admin tem todas

        const newPerms = new Set(selectedPermissions);
        if (newPerms.has(code)) {
            newPerms.delete(code);
        } else {
            newPerms.add(code);
        }
        setSelectedPermissions(newPerms);
    };

    const handleToggleGroup = (permissions: PermissionCode[]) => {
        if (role === 'admin') return;

        const newPerms = new Set(selectedPermissions);
        const allSelected = permissions.every(p => newPerms.has(p));

        if (allSelected) {
            permissions.forEach(p => newPerms.delete(p));
        } else {
            permissions.forEach(p => newPerms.add(p));
        }
        setSelectedPermissions(newPerms);
    };

    const handleRoleChange = async (newRole: 'admin' | 'user') => {
        setRole(newRole);
        if (newRole === 'admin') {
            // Admin tem todas as permissões
            setSelectedPermissions(new Set(Object.keys(ALL_PERMISSIONS)));
        } else {
            // Usuário começa com permissões padrão do role
            setSelectedPermissions(new Set(ROLE_PERMISSIONS.user));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // Atualizar role
            if (role !== userRole) {
                const roleResult = await updateUserRole(userId, role as 'admin' | 'user', currentUserRole);
                if (!roleResult.success) {
                    setMessage({ type: 'error', text: roleResult.message });
                    setSaving(false);
                    return;
                }
            }

            // Atualizar permissões (apenas se não for admin)
            if (role !== 'admin') {
                const permsResult = await updateUserPermissions(userId, Array.from(selectedPermissions), undefined, currentUserRole);
                if (!permsResult.success) {
                    setMessage({ type: 'error', text: permsResult.message });
                    setSaving(false);
                    return;
                }
            }

            setMessage({ type: 'success', text: 'Permissões salvas com sucesso!' });
            setTimeout(() => {
                onSave();
                onClose();
            }, 1000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar permissões' });
        } finally {
            setSaving(false);
        }
    };

    const isPermissionSelected = (code: string) => {
        if (role === 'admin') return true;
        return selectedPermissions.has(code);
    };

    const isGroupFullySelected = (permissions: PermissionCode[]) => {
        return permissions.every(p => isPermissionSelected(p));
    };

    const isGroupPartiallySelected = (permissions: PermissionCode[]) => {
        const selected = permissions.filter(p => isPermissionSelected(p));
        return selected.length > 0 && selected.length < permissions.length;
    };

    if (loading) {
        return (
            <div className={styles.modal}>
                <div className={styles.modalContent}>
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.modal} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
                <div className={styles.modalHeader}>
                    <h2>🔐 Permissões de {userName}</h2>
                    <button onClick={onClose} className={styles.closeBtn}>✕</button>
                </div>

                {message && (
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        margin: '1rem',
                        background: message.type === 'success' ? '#10b98120' : '#ef444420',
                        color: message.type === 'success' ? '#10b981' : '#ef4444'
                    }}>
                        {message.type === 'success' ? '✅' : '❌'} {message.text}
                    </div>
                )}

                <div style={{ padding: '1rem' }}>
                    {/* Seletor de Role */}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Cargo do Usuário</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => handleRoleChange('user')}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    border: '2px solid',
                                    borderColor: role === 'user' ? 'var(--primary-color)' : 'transparent',
                                    borderRadius: '8px',
                                    background: role === 'user' ? 'var(--primary-color)20' : 'var(--bg-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👤</div>
                                <div style={{ fontWeight: 600 }}>Usuário</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Acesso limitado conforme permissões</div>
                            </button>
                            {/* Apenas admins podem definir outros usuários como admin */}
                            {currentUserRole === 'admin' && (
                                <button
                                    onClick={() => handleRoleChange('admin')}
                                    style={{
                                        flex: 1,
                                        padding: '1rem',
                                        border: '2px solid',
                                        borderColor: role === 'admin' ? 'var(--primary-color)' : 'transparent',
                                        borderRadius: '8px',
                                        background: role === 'admin' ? 'var(--primary-color)20' : 'var(--bg-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👑</div>
                                    <div style={{ fontWeight: 600 }}>Administrador</div>
                                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Acesso total ao sistema</div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Permissões por Módulo */}
                    {role !== 'admin' && (
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>Permissões por Módulo</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                {Object.entries(PERMISSION_GROUPS).map(([key, group]) => {
                                    // Filtrar permissões que o usuário atual pode ver
                                    const visiblePermissions = group.permissions.filter(code =>
                                        currentUserRole === 'admin' || !RESTRICTED_FOR_NON_ADMINS.includes(code)
                                    );

                                    // Se não tem permissões visíveis neste grupo, não renderizar o grupo
                                    if (visiblePermissions.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                border: isGroupFullySelected(visiblePermissions) ? '2px solid var(--primary-color)' : '2px solid transparent'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    marginBottom: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => handleToggleGroup(visiblePermissions)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isGroupFullySelected(visiblePermissions)}
                                                    ref={input => {
                                                        if (input) input.indeterminate = isGroupPartiallySelected(visiblePermissions);
                                                    }}
                                                    onChange={() => handleToggleGroup(visiblePermissions)}
                                                />
                                                <span style={{ fontSize: '1.2rem' }}>{group.icon}</span>
                                                <span style={{ fontWeight: 600 }}>{group.label}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1.5rem' }}>
                                                {visiblePermissions.map(code => {
                                                    const perm = ALL_PERMISSIONS[code];
                                                    return (
                                                        <label
                                                            key={code}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                cursor: 'pointer',
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isPermissionSelected(code)}
                                                                onChange={() => handleTogglePermission(code)}
                                                            />
                                                            <span>{perm.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {role === 'admin' && (
                        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👑</div>
                            <h3>Administrador tem acesso total</h3>
                            <p style={{ opacity: 0.7 }}>Todas as permissões estão automaticamente habilitadas para administradores.</p>
                        </div>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button onClick={onClose} className={styles.btnSecondary}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className={styles.btnPrimary}>
                        {saving ? '⏳ Salvando...' : '💾 Salvar Permissões'}
                    </button>
                </div>
            </div>
        </div>
    );
}
