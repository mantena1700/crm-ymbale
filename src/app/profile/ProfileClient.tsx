'use client';

import { useState } from 'react';
import { updateProfile, uploadProfilePhoto, UserProfile } from './actions';
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

            // Upload foto se houver
            if (photoFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('photo', photoFile);
                const uploadResult = await uploadProfilePhoto(uploadFormData);
                if (uploadResult.success && uploadResult.photoUrl) {
                    photoUrl = uploadResult.photoUrl;
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
                                <div className={styles.field}>
                                    <label>Cargo</label>
                                    <input
                                        type="text"
                                        value={formData.role}
                                        onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                        placeholder="Seu cargo"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>Departamento</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        placeholder="Seu departamento"
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

                    {/* Estatísticas */}
                    <div className={styles.card}>
                        <h3>📊 Estatísticas</h3>
                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>104</span>
                                <span className={styles.statLabel}>Leads Gerenciados</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>23</span>
                                <span className={styles.statLabel}>Análises Realizadas</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>6</span>
                                <span className={styles.statLabel}>Conversões</span>
                            </div>
                        </div>
                    </div>

                    {/* Segurança */}
                    <div className={styles.card}>
                        <h3>🔒 Segurança</h3>
                        <div className={styles.security}>
                            <button className={styles.securityBtn}>
                                🔑 Alterar Senha
                            </button>
                            <button className={styles.securityBtn}>
                                📱 Ativar 2FA
                            </button>
                            <div className={styles.lastLogin}>
                                <span>Último acesso:</span>
                                <span>Hoje, {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

