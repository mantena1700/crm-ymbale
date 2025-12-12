'use client';

import { useState, useEffect, useMemo } from 'react';
import { getFixedClients, createFixedClient, updateFixedClient, deleteFixedClient } from './actions';
import styles from './page.module.css';

interface FixedClientsSectionProps {
    sellerId: string;
    restaurants: Array<{
        id: string;
        name: string;
        address?: any;
    }>;
}

interface FixedClient {
    id: string;
    sellerId: string;
    restaurantId: string | null;
    restaurant: {
        id: string;
        name: string;
        address: any;
    } | null;
    clientName?: string | null;
    clientAddress?: any;
    recurrenceType: 'monthly_days' | 'weekly_days';
    monthlyDays: number[];
    weeklyDays: number[];
    radiusKm: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export default function FixedClientsSection({ sellerId, restaurants }: FixedClientsSectionProps) {
    const [fixedClients, setFixedClients] = useState<FixedClient[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        clientType: 'manual' as 'base' | 'manual', // 'base' = da base, 'manual' = cadastro manual
        restaurantId: '',
        clientName: '',
        clientAddress: {
            street: '',
            neighborhood: '',
            city: '',
            state: '',
            zip: ''
        },
        recurrenceType: 'weekly_days' as 'monthly_days' | 'weekly_days',
        monthlyDays: [] as number[],
        weeklyDays: [] as number[],
        radiusKm: 10
    });

    // Carregar clientes fixos
    const loadFixedClients = async () => {
        if (!sellerId) return;
        
        setLoading(true);
        try {
            const data = await getFixedClients(sellerId);
            setFixedClients(data);
        } catch (error) {
            console.error('Erro ao carregar clientes fixos:', error);
            alert('Erro ao carregar clientes fixos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFixedClients();
    }, [sellerId]);

    // Restaurantes disponíveis (da carteira do executivo) - apenas para clientes da base
    const availableRestaurants = useMemo(() => {
        const fixedRestaurantIds = new Set(fixedClients.filter(fc => fc.restaurantId).map(fc => fc.restaurantId!));
        return restaurants.filter(r => !fixedRestaurantIds.has(r.id) || editingId);
    }, [restaurants, fixedClients, editingId]);

    // Salvar cliente fixo
    const handleSave = async () => {
        if (!sellerId) {
            alert('Selecione um executivo primeiro.');
            return;
        }

        if (!formData.restaurantId) {
            alert('Selecione um restaurante.');
            return;
        }

        if (formData.recurrenceType === 'monthly_days' && formData.monthlyDays.length === 0) {
            alert('Selecione pelo menos um dia do mês.');
            return;
        }

        if (formData.recurrenceType === 'weekly_days' && formData.weeklyDays.length === 0) {
            alert('Selecione pelo menos um dia da semana.');
            return;
        }

        setLoading(true);
        try {
            let result;
            if (editingId) {
                result = await updateFixedClient(editingId, {
                    recurrenceType: formData.recurrenceType,
                    monthlyDays: formData.monthlyDays,
                    weeklyDays: formData.weeklyDays,
                    radiusKm: formData.radiusKm
                });
            } else {
                result = await createFixedClient({
                    sellerId,
                    restaurantId: formData.restaurantId,
                    recurrenceType: formData.recurrenceType,
                    monthlyDays: formData.monthlyDays,
                    weeklyDays: formData.weeklyDays,
                    radiusKm: formData.radiusKm
                });
            }

            if (result.success) {
                await loadFixedClients();
                setShowForm(false);
                setEditingId(null);
                setFormData({
                    clientType: 'manual',
                    restaurantId: '',
                    clientName: '',
                    clientAddress: {
                        street: '',
                        neighborhood: '',
                        city: '',
                        state: '',
                        zip: ''
                    },
                    recurrenceType: 'weekly_days',
                    monthlyDays: [],
                    weeklyDays: [],
                    radiusKm: 10
                });
                alert('✅ Cliente fixo salvo com sucesso!');
            } else {
                alert(`❌ Erro: ${result.error}`);
            }
        } catch (error: any) {
            console.error('Erro ao salvar cliente fixo:', error);
            alert(`❌ Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    // Editar cliente fixo
    const handleEdit = (fixedClient: FixedClient) => {
        setEditingId(fixedClient.id);
        setFormData({
            restaurantId: fixedClient.restaurantId,
            recurrenceType: fixedClient.recurrenceType,
            monthlyDays: fixedClient.monthlyDays,
            weeklyDays: fixedClient.weeklyDays,
            radiusKm: fixedClient.radiusKm
        });
        setShowForm(true);
    };

    // Deletar cliente fixo
    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover este cliente fixo?')) return;

        setLoading(true);
        try {
            const result = await deleteFixedClient(id);
            if (result.success) {
                await loadFixedClients();
                alert('✅ Cliente fixo removido com sucesso!');
            } else {
                alert(`❌ Erro: ${result.error}`);
            }
        } catch (error: any) {
            console.error('Erro ao deletar cliente fixo:', error);
            alert(`❌ Erro ao deletar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle dia da semana
    const toggleWeeklyDay = (day: number) => {
        setFormData(prev => ({
            ...prev,
            weeklyDays: prev.weeklyDays.includes(day)
                ? prev.weeklyDays.filter(d => d !== day)
                : [...prev.weeklyDays, day].sort()
        }));
    };

    // Adicionar/remover dia do mês
    const handleMonthlyDayChange = (day: number, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            monthlyDays: checked
                ? [...prev.monthlyDays, day].sort((a, b) => a - b)
                : prev.monthlyDays.filter(d => d !== day)
        }));
    };

    if (!sellerId) {
        return (
            <div className={styles.emptyState}>
                <span>👔</span>
                <h3>Selecione um Executivo</h3>
                <p>Selecione um executivo para gerenciar seus clientes fixos</p>
            </div>
        );
    }

    return (
        <div className={styles.fixedClientsContainer}>
            <div className={styles.fixedClientsHeader}>
                <div>
                    <h2>📌 Clientes Fixos</h2>
                    <p>Gerencie clientes que são visitados regularmente. O preenchimento inteligente agendará clientes próximos no mesmo dia.</p>
                </div>
                <button
                    className={styles.primaryBtn}
                    onClick={() => {
                        setShowForm(true);
                        setEditingId(null);
                        setFormData({
                            restaurantId: '',
                            recurrenceType: 'weekly_days',
                            monthlyDays: [],
                            weeklyDays: [],
                            radiusKm: 10
                        });
                    }}
                >
                    ➕ Adicionar Cliente Fixo
                </button>
            </div>

            {/* Formulário */}
            {showForm && (
                <div className={styles.fixedClientForm}>
                    <h3>{editingId ? '✏️ Editar Cliente Fixo' : '➕ Novo Cliente Fixo'}</h3>
                    
                    <div className={styles.formRow}>
                        <div className={styles.formField}>
                            <label>Tipo de Cliente *</label>
                            <select
                                value={formData.clientType}
                                onChange={e => setFormData(prev => ({ 
                                    ...prev, 
                                    clientType: e.target.value as 'base' | 'manual',
                                    restaurantId: '',
                                    clientName: '',
                                    clientAddress: {
                                        street: '',
                                        neighborhood: '',
                                        city: '',
                                        state: '',
                                        zip: ''
                                    }
                                }))}
                                disabled={!!editingId}
                            >
                                <option value="manual">Cadastro Manual (Novo Cliente)</option>
                                <option value="base">Da Base de Restaurantes</option>
                            </select>
                        </div>

                        <div className={styles.formField}>
                            <label>Raio de Proximidade (km) *</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                step="0.5"
                                value={formData.radiusKm}
                                onChange={e => setFormData(prev => ({ ...prev, radiusKm: parseFloat(e.target.value) || 10 }))}
                            />
                            <small>Clientes dentro deste raio serão agendados no mesmo dia</small>
                        </div>
                    </div>

                    {formData.clientType === 'base' ? (
                        <div className={styles.formField}>
                            <label>Restaurante da Base *</label>
                            <select
                                value={formData.restaurantId}
                                onChange={e => setFormData(prev => ({ ...prev, restaurantId: e.target.value }))}
                                disabled={!!editingId}
                            >
                                <option value="">Selecione um restaurante</option>
                                {restaurants.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <>
                            <div className={styles.formField}>
                                <label>Nome do Cliente *</label>
                                <input
                                    type="text"
                                    value={formData.clientName}
                                    onChange={e => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                                    placeholder="Nome do cliente/restaurante"
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label>Endereço (Rua) *</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.street || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), street: e.target.value }
                                        }))}
                                        placeholder="Rua, Avenida, etc."
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <label>Número</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.number || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), number: e.target.value }
                                        }))}
                                        placeholder="Número"
                                    />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label>Bairro *</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.neighborhood || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), neighborhood: e.target.value }
                                        }))}
                                        placeholder="Bairro"
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <label>Cidade *</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.city || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), city: e.target.value }
                                        }))}
                                        placeholder="Cidade"
                                    />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label>Estado *</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.state || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), state: e.target.value }
                                        }))}
                                        placeholder="Estado (ex: SP)"
                                        maxLength={2}
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <label>CEP</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress?.zip || ''}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            clientAddress: { ...(prev.clientAddress || {}), zip: e.target.value }
                                        }))}
                                        placeholder="00000-000"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className={styles.formRow}>
                        <div className={styles.formField}>
                            <label>Tipo de Recorrência *</label>
                            <select
                                value={formData.recurrenceType}
                                onChange={e => setFormData(prev => ({ 
                                    ...prev, 
                                    recurrenceType: e.target.value as 'monthly_days' | 'weekly_days',
                                    monthlyDays: [],
                                    weeklyDays: []
                                }))}
                            >
                                <option value="weekly_days">Dias da Semana</option>
                                <option value="monthly_days">Dias do Mês</option>
                            </select>
                        </div>
                    </div>

                    {formData.recurrenceType === 'weekly_days' && (
                        <div className={styles.formField}>
                            <label>Dias da Semana *</label>
                            <div className={styles.weeklyDaysGrid}>
                                {[
                                    { value: 0, label: 'Dom' },
                                    { value: 1, label: 'Seg' },
                                    { value: 2, label: 'Ter' },
                                    { value: 3, label: 'Qua' },
                                    { value: 4, label: 'Qui' },
                                    { value: 5, label: 'Sex' },
                                    { value: 6, label: 'Sáb' }
                                ].map(day => (
                                    <label key={day.value} className={styles.dayCheckbox}>
                                        <input
                                            type="checkbox"
                                            checked={formData.weeklyDays.includes(day.value)}
                                            onChange={() => toggleWeeklyDay(day.value)}
                                        />
                                        <span>{day.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {formData.recurrenceType === 'monthly_days' && (
                        <div className={styles.formField}>
                            <label>Dias do Mês *</label>
                            <div className={styles.monthlyDaysGrid}>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                    const now = new Date();
                                    const date = new Date(now.getFullYear(), now.getMonth(), day);
                                    const dayOfWeek = date.getDay();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    
                                    return (
                                        <label key={day} className={styles.dayCheckbox} title={isWeekend ? `⚠️ Este dia cai em ${dayOfWeek === 0 ? 'domingo' : 'sábado'} e será ajustado para o próximo dia útil` : ''}>
                                            <input
                                                type="checkbox"
                                                checked={formData.monthlyDays.includes(day)}
                                                onChange={e => handleMonthlyDayChange(day, e.target.checked)}
                                            />
                                            <span style={{ color: isWeekend ? '#f59e0b' : 'inherit' }}>
                                                {day}
                                                {isWeekend && ' ⚠️'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <small>⚠️ Dias que caem em sábado ou domingo serão automaticamente ajustados para o próximo dia útil (segunda-feira)</small>
                        </div>
                    )}

                    <div className={styles.formActions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            className={styles.confirmBtn}
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de Clientes Fixos */}
            <div className={styles.fixedClientsList}>
                {loading && !showForm ? (
                    <div className={styles.loading}>Carregando...</div>
                ) : fixedClients.length === 0 ? (
                    <div className={styles.emptyState}>
                        <span>📌</span>
                        <h3>Nenhum Cliente Fixo Cadastrado</h3>
                        <p>Adicione clientes fixos para otimizar o preenchimento inteligente da agenda</p>
                    </div>
                ) : (
                    <table className={styles.fixedClientsTable}>
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Endereço</th>
                                <th>Recorrência</th>
                                <th>Raio (km)</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fixedClients.map(fc => {
                                const address = typeof fc.restaurant.address === 'string' 
                                    ? JSON.parse(fc.restaurant.address) 
                                    : fc.restaurant.address;
                                
                                let recurrenceText = '';
                                if (fc.recurrenceType === 'weekly_days') {
                                    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                    const days = fc.weeklyDays.map(d => dayNames[d]).join(', ');
                                    recurrenceText = `Toda(s) ${days}`;
                                } else {
                                    recurrenceText = `Dias ${fc.monthlyDays.join(', ')} do mês`;
                                }

                                return (
                                    <tr key={fc.id}>
                                        <td><strong>{fc.restaurant.name}</strong></td>
                                        <td>
                                            {address?.city || address?.cidade || 'N/D'}
                                            {address?.neighborhood && ` - ${address.neighborhood}`}
                                        </td>
                                        <td>{recurrenceText}</td>
                                        <td>{fc.radiusKm} km</td>
                                        <td>
                                            <div className={styles.tableActions}>
                                                <button
                                                    onClick={() => handleEdit(fc)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(fc.id)}
                                                    title="Remover"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

