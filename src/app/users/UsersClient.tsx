'use client';

import { useState } from 'react';
import { createUser, updateUser, deleteUser, toggleUserStatus, resetPassword, unlockUserAndResetPassword, UserData } from './actions';
import styles from './page.module.css';

interface Props {
    initialUsers: UserData[];
    currentUserId: string;
}

export default function UsersClient({ initialUsers, currentUserId }: Props) {
    const [users, setUsers] = useState<UserData[]>(initialUsers);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        email: '',
        password: '',
        role: 'user' as 'admin' | 'user'
    });

    const [showResetPassword, setShowResetPassword] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const resetForm = () => {
        setFormData({
            username: '',
            name: '',
            email: '',
            password: '',
            role: 'user'
        });
        setEditingUser(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (user: UserData) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            name: user.name,
            email: user.email || '',
            password: '',
            role: user.role
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (editingUser) {
                // Atualizar
                const result = await updateUser(editingUser.id, {
                    name: formData.name,
                    email: formData.email || undefined,
                    role: formData.role,
                    password: formData.password || undefined
                });

                if (result.success) {
                    setUsers(prev => prev.map(u => 
                        u.id === editingUser.id 
                            ? { ...u, name: formData.name, email: formData.email || null, role: formData.role }
                            : u
                    ));
                    setShowModal(false);
                    setMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
                } else {
                    setMessage({ type: 'error', text: result.error || 'Erro ao atualizar' });
                }
            } else {
                // Criar
                if (!formData.password) {
                    setMessage({ type: 'error', text: 'Senha é obrigatória' });
                    setLoading(false);
                    return;
                }

                const result = await createUser({
                    username: formData.username,
                    name: formData.name,
                    email: formData.email || undefined,
                    password: formData.password,
                    role: formData.role
                });

                if (result.success && result.user) {
                    setUsers(prev => [...prev, {
                        id: result.user!.id,
                        username: result.user!.username,
                        name: result.user!.name,
                        email: formData.email || null,
                        role: formData.role,
                        active: true,
                        lastLogin: null,
                        createdAt: new Date().toISOString()
                    }]);
                    setShowModal(false);
                    setMessage({ type: 'success', text: 'Usuário criado com sucesso!' });
                } else {
                    setMessage({ type: 'error', text: result.error || 'Erro ao criar' });
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro inesperado' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (user: UserData) => {
        if (!confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)) return;

        const result = await deleteUser(user.id, currentUserId);
        if (result.success) {
            setUsers(prev => prev.filter(u => u.id !== user.id));
            setMessage({ type: 'success', text: 'Usuário excluído com sucesso!' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir' });
        }
    };

    const handleToggleStatus = async (user: UserData) => {
        const result = await toggleUserStatus(user.id, currentUserId);
        if (result.success) {
            setUsers(prev => prev.map(u => 
                u.id === user.id ? { ...u, active: result.active! } : u
            ));
            setMessage({ 
                type: 'success', 
                text: `Usuário ${result.active ? 'ativado' : 'desativado'} com sucesso!` 
            });
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao alterar status' });
        }
    };

    const handleResetPassword = async () => {
        if (!showResetPassword || !newPassword) return;

        setLoading(true);
        const result = await resetPassword(showResetPassword, newPassword);
        
        if (result.success) {
            setMessage({ type: 'success', text: 'Senha redefinida com sucesso!' });
            setShowResetPassword(null);
            setNewPassword('');
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao redefinir senha' });
        }
        setLoading(false);
    };

    const handleUnlock = async (user: UserData) => {
        if (!confirm(`Desbloquear a conta de "${user.name}"?\n\nUma nova senha aleatória será gerada.`)) return;

        setLoading(true);
        const result = await unlockUserAndResetPassword(user.id, currentUserId);
        
        if (result.success && result.newPassword) {
            setUsers(prev => prev.map(u => 
                u.id === user.id ? { ...u, locked: false, loginAttempts: 0, mustChangePassword: true } : u
            ));
            
            // Mostrar a nova senha em um alert para o admin copiar
            alert(`✅ Conta desbloqueada!\n\nNova senha temporária:\n\n${result.newPassword}\n\nO usuário será obrigado a trocar a senha no próximo login.`);
            
            setMessage({ type: 'success', text: 'Conta desbloqueada com sucesso!' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao desbloquear' });
        }
        setLoading(false);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>👥 Gerenciar Usuários</h1>
                    <p>Administre os usuários do sistema</p>
                </div>
                <button className={styles.addBtn} onClick={openCreateModal}>
                    ➕ Novo Usuário
                </button>
            </header>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            <div className={styles.statsCards}>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>👥</span>
                    <div>
                        <span className={styles.statValue}>{users.length}</span>
                        <span className={styles.statLabel}>Total de Usuários</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>👑</span>
                    <div>
                        <span className={styles.statValue}>{users.filter(u => u.role === 'admin').length}</span>
                        <span className={styles.statLabel}>Administradores</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>✅</span>
                    <div>
                        <span className={styles.statValue}>{users.filter(u => u.active && !u.locked).length}</span>
                        <span className={styles.statLabel}>Ativos</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>🔒</span>
                    <div>
                        <span className={styles.statValue}>{users.filter(u => u.locked).length}</span>
                        <span className={styles.statLabel}>Bloqueados</span>
                    </div>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Função</th>
                            <th>Status</th>
                            <th>Último Login</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className={!user.active ? styles.inactive : ''}>
                                <td>
                                    <div className={styles.userCell}>
                                        <span className={styles.avatar}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                        <span className={styles.username}>@{user.username}</span>
                                    </div>
                                </td>
                                <td>{user.name}</td>
                                <td>{user.email || '-'}</td>
                                <td>
                                    <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                                        {user.role === 'admin' ? '👑 Admin' : '👤 Usuário'}
                                    </span>
                                </td>
                                <td>
                                    {user.locked ? (
                                        <span className={`${styles.statusBadge} ${styles.locked}`}>
                                            🔒 Bloqueado
                                        </span>
                                    ) : user.mustChangePassword ? (
                                        <span className={`${styles.statusBadge} ${styles.warning}`}>
                                            ⚠️ Trocar Senha
                                        </span>
                                    ) : (
                                        <span className={`${styles.statusBadge} ${user.active ? styles.active : styles.inactiveStatus}`}>
                                            {user.active ? '✅ Ativo' : '❌ Inativo'}
                                        </span>
                                    )}
                                </td>
                                <td className={styles.dateCell}>{formatDate(user.lastLogin)}</td>
                                <td>
                                    <div className={styles.actions}>
                                        {user.locked ? (
                                            <button 
                                                className={`${styles.actionBtn} ${styles.unlock}`}
                                                onClick={() => handleUnlock(user)}
                                                title="Desbloquear e Gerar Nova Senha"
                                                disabled={loading}
                                            >
                                                🔓
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    className={styles.actionBtn}
                                                    onClick={() => openEditModal(user)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className={styles.actionBtn}
                                                    onClick={() => setShowResetPassword(user.id)}
                                                    title="Redefinir Senha"
                                                >
                                                    🔑
                                                </button>
                                                <button 
                                                    className={`${styles.actionBtn} ${user.active ? styles.deactivate : styles.activate}`}
                                                    onClick={() => handleToggleStatus(user)}
                                                    title={user.active ? 'Desativar' : 'Ativar'}
                                                    disabled={user.id === currentUserId}
                                                >
                                                    {user.active ? '🚫' : '✅'}
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            className={`${styles.actionBtn} ${styles.delete}`}
                                            onClick={() => handleDelete(user)}
                                            title="Excluir"
                                            disabled={user.id === currentUserId}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Criar/Editar */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingUser ? '✏️ Editar Usuário' : '➕ Novo Usuário'}</h2>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            {!editingUser && (
                                <div className={styles.field}>
                                    <label>Nome de Usuário *</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                                        }))}
                                        placeholder="usuario123"
                                        required
                                        pattern="[a-z0-9_]+"
                                        minLength={3}
                                        maxLength={30}
                                    />
                                    <span className={styles.hint}>Apenas letras minúsculas, números e _</span>
                                </div>
                            )}

                            <div className={styles.field}>
                                <label>Nome Completo *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="João Silva"
                                    required
                                />
                            </div>

                            <div className={styles.field}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="joao@email.com"
                                />
                            </div>

                            <div className={styles.field}>
                                <label>{editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder={editingUser ? '••••••••' : 'Mínimo 4 caracteres'}
                                    minLength={4}
                                    required={!editingUser}
                                />
                            </div>

                            <div className={styles.field}>
                                <label>Função *</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData(prev => ({ 
                                        ...prev, 
                                        role: e.target.value as 'admin' | 'user' 
                                    }))}
                                >
                                    <option value="user">👤 Usuário</option>
                                    <option value="admin">👑 Administrador</option>
                                </select>
                            </div>

                            <div className={styles.formActions}>
                                <button 
                                    type="button" 
                                    className={styles.cancelBtn}
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className={styles.submitBtn}
                                    disabled={loading}
                                >
                                    {loading ? 'Salvando...' : (editingUser ? 'Salvar Alterações' : 'Criar Usuário')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Reset de Senha */}
            {showResetPassword && (
                <div className={styles.modalOverlay} onClick={() => setShowResetPassword(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>🔑 Redefinir Senha</h2>
                            <button className={styles.closeBtn} onClick={() => setShowResetPassword(null)}>×</button>
                        </div>

                        <div className={styles.form}>
                            <div className={styles.field}>
                                <label>Nova Senha *</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 4 caracteres"
                                    minLength={4}
                                />
                            </div>

                            <div className={styles.formActions}>
                                <button 
                                    type="button" 
                                    className={styles.cancelBtn}
                                    onClick={() => setShowResetPassword(null)}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    className={styles.submitBtn}
                                    onClick={handleResetPassword}
                                    disabled={loading || newPassword.length < 4}
                                >
                                    {loading ? 'Salvando...' : 'Redefinir Senha'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

