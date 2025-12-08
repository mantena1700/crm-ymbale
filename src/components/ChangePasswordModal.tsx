'use client';

import { useState } from 'react';
import { changeOwnPassword } from '@/app/users/actions';
import styles from './ChangePasswordModal.module.css';

interface Props {
    userId: string;
    onSuccess: () => void;
}

export default function ChangePasswordModal({ userId, onSuccess }: Props) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            setError('A nova senha deve ter no mínimo 6 caracteres');
            return;
        }

        setLoading(true);

        const result = await changeOwnPassword(userId, currentPassword, newPassword);

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || 'Erro ao alterar senha');
        }

        setLoading(false);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.icon}>🔐</div>
                    <h2>Alteração de Senha Obrigatória</h2>
                    <p>Sua senha foi redefinida pelo administrador. Por segurança, você precisa criar uma nova senha.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.error}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div className={styles.field}>
                        <label>Senha Atual (temporária)</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Digite a senha que recebeu"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Nova Senha</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Confirmar Nova Senha</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repita a nova senha"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <label className={styles.showPassword}>
                        <input
                            type="checkbox"
                            checked={showPasswords}
                            onChange={e => setShowPasswords(e.target.checked)}
                        />
                        Mostrar senhas
                    </label>

                    <div className={styles.requirements}>
                        <h4>Requisitos da senha:</h4>
                        <ul>
                            <li className={newPassword.length >= 6 ? styles.valid : ''}>
                                Mínimo 6 caracteres
                            </li>
                            <li className={newPassword !== currentPassword && newPassword.length > 0 ? styles.valid : ''}>
                                Diferente da senha atual
                            </li>
                            <li className={newPassword === confirmPassword && newPassword.length > 0 ? styles.valid : ''}>
                                Senhas coincidem
                            </li>
                        </ul>
                    </div>

                    <button 
                        type="submit" 
                        className={styles.submitBtn}
                        disabled={loading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                    >
                        {loading ? 'Salvando...' : '🔒 Alterar Senha'}
                    </button>
                </form>
            </div>
        </div>
    );
}

