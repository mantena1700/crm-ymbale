'use client';

import { useState } from 'react';
import { updateProfile, uploadProfilePhoto, changePassword, UserProfile } from './actions';
import styles from './page.module.css';

interface Props {
    initialProfile: UserProfile;
}

export default function ProfileClient({ initialProfile }: Props) {
    const [profile, setProfile] = useState<UserProfile>(initialProfile);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photoUrl || null);

    // Password change states
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        department: profile.department,
        bio: profile.bio || '',
    });

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onload = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);

        try {
            let photoUrl = profile.photoUrl;

            if (photoFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('photo', photoFile);
                const uploadResult = await uploadProfilePhoto(uploadFormData);
                if (uploadResult.success && 'photoUrl' in uploadResult && uploadResult.photoUrl) {
                    photoUrl = uploadResult.photoUrl as string;
                }
            }

            const result = await updateProfile({
                ...formData,
                photoUrl,
                preferences: profile.preferences
            });

            if (result.success) {
                setProfile(prev => ({ ...prev, ...formData, photoUrl }));
                setEditing(false);
                setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            } else {
                setMessage({ type: 'error', text: result.error || 'Erro ao salvar' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Erro ao salvar perfil' });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            department: profile.department,
            bio: profile.bio || '',
        });
        setPhotoFile(null);
        setPhotoPreview(profile.photoUrl || null);
        setEditing(false);
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'As senhas não coincidem' });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
            return;
        }

        setPasswordLoading(true);
        setPasswordMessage(null);

        try {
            const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);

            if (result.success) {
                setPasswordMessage({ type: 'success', text: result.message || 'Senha alterada com sucesso!' });
                setTimeout(() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordMessage(null);
                }, 2000);
            } else {
                setPasswordMessage({ type: 'error', text: result.error || 'Erro ao alterar senha' });
            }
        } catch (error: any) {
            setPasswordMessage({ type: 'error', text: error.message || 'Erro ao alterar senha' });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>👤 Meu Perfil</h1>
                <p>Gerencie suas informações pessoais e preferências</p>
            </header>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            <div className={styles.content}>
                {/* Card Principal */}
                <div className={styles.mainCard}>
                    <div className={styles.photoSection}>
                        <div className={styles.photoWrapper}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Foto de perfil" className={styles.photo} />
                            ) : (
                                <div className={styles.photoPlaceholder}>
                                    <span>{profile.name.charAt(0).toUpperCase()}</span>
                                </div>
                            )}
                            {editing && (
                                <label className={styles.photoUpload}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        hidden
                                    />
                                    📷
                                </label>
                            )}
                        </div>
                        {!editing && (
                            <div className={styles.photoInfo}>
                                <h2>{profile.name}</h2>
                                <span className={styles.role}>{profile.role}</span>
                                <span className={styles.department}>{profile.department}</span>
                            </div>
                        )}
                    </div>

                    {editing ? (
                        <div className={styles.form}>
                            <div className={styles.formGrid}>
                                <div className={styles.field}>
                                    <label>Nome Completo</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Seu nome"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                            </div>
                            <div className={styles.fieldFull}>
                                <label>Biografia</label>
                                <textarea
                                    value={formData.bio}
                                    onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                    placeholder="Conte um pouco sobre você..."
                                    rows={4}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.details}>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detail}>
                                    <span className={styles.detailIcon}>📧</span>
                                    <div>
                                        <label>Email</label>
                                        <span>{profile.email}</span>
                                    </div>
                                </div>
                                <div className={styles.detail}>
                                    <span className={styles.detailIcon}>📱</span>
                                    <div>
                                        <label>Telefone</label>
                                        <span>{profile.phone || 'Não informado'}</span>
                                    </div>
                                </div>
                                <div className={styles.detail}>
                                    <span className={styles.detailIcon}>💼</span>
                                    <div>
                                        <label>Cargo</label>
                                        <span>{profile.role}</span>
                                    </div>
                                </div>
                                <div className={styles.detail}>
                                    <span className={styles.detailIcon}>🏢</span>
                                    <div>
                                        <label>Departamento</label>
                                        <span>{profile.department}</span>
                                    </div>
                                </div>
                            </div>
                            {profile.bio && (
                                <div className={styles.bio}>
                                    <label>Sobre mim</label>
                                    <p>{profile.bio}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className={styles.actions}>
                        {editing ? (
                            <>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={handleCancel}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className={styles.saveBtn}
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    {loading ? 'Salvando...' : '✓ Salvar Alterações'}
                                </button>
                            </>
                        ) : (
                            <button
                                className={styles.editBtn}
                                onClick={() => setEditing(true)}
                            >
                                ✏️ Editar Perfil
                            </button>
                        )}
                    </div>
                </div>

                {/* Cards Laterais */}
                <div className={styles.sideCards}>
                    {/* Segurança */}
                    <div className={styles.card}>
                        <h3>🔒 Segurança</h3>
                        <div className={styles.security}>
                            <button
                                className={styles.securityBtn}
                                onClick={() => setShowPasswordModal(true)}
                            >
                                🔑 Alterar Senha
                            </button>
                            <div className={styles.lastLogin}>
                                <span>Último acesso:</span>
                                <span>Agora</span>
                            </div>
                        </div>
                    </div>

                    {/* Preferências */}
                    <div className={styles.card}>
                        <h3>⚙️ Preferências</h3>
                        <div className={styles.preferences}>
                            <label className={styles.toggle}>
                                <span>Notificações Push</span>
                                <input
                                    type="checkbox"
                                    checked={profile.preferences.notifications}
                                    onChange={e => setProfile(prev => ({
                                        ...prev,
                                        preferences: { ...prev.preferences, notifications: e.target.checked }
                                    }))}
                                />
                                <span className={styles.slider}></span>
                            </label>
                            <label className={styles.toggle}>
                                <span>Alertas por Email</span>
                                <input
                                    type="checkbox"
                                    checked={profile.preferences.emailAlerts}
                                    onChange={e => setProfile(prev => ({
                                        ...prev,
                                        preferences: { ...prev.preferences, emailAlerts: e.target.checked }
                                    }))}
                                />
                                <span className={styles.slider}></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className={styles.modal} onClick={() => setShowPasswordModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => setShowPasswordModal(false)}>✕</button>
                        <h2>🔑 Alterar Senha</h2>

                        {passwordMessage && (
                            <div className={`${styles.message} ${styles[passwordMessage.type]}`}>
                                {passwordMessage.type === 'success' ? '✅' : '❌'} {passwordMessage.text}
                            </div>
                        )}

                        <div className={styles.form}>
                            <div className={styles.field}>
                                <label>Senha Atual</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={e => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    placeholder="Digite sua senha atual"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Nova Senha</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                    placeholder="Digite a nova senha (mín. 6 caracteres)"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={e => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    placeholder="Confirme a nova senha"
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowPasswordModal(false)}
                                disabled={passwordLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.saveBtn}
                                onClick={handlePasswordChange}
                                disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword}
                            >
                                {passwordLoading ? 'Alterando...' : '✓ Alterar Senha'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
