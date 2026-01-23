'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout, Card, Button } from '@/components/PageLayout';
import styles from './page.module.css';

export default function NewClientPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zip: '',
        category: '',
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.city) {
            alert('Nome e Cidade são obrigatórios!');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone || null,
                    email: formData.email || null,
                    address: {
                        street: formData.street,
                        number: formData.number,
                        neighborhood: formData.neighborhood,
                        city: formData.city,
                        state: formData.state,
                        zip: formData.zip
                    },
                    category: formData.category || 'Restaurante',
                    notes: formData.notes,
                    status: 'A Analisar',
                    salesPotential: 'MEDIO'
                })
            });

            if (response.ok) {
                alert('✅ Cliente cadastrado com sucesso!');
                router.push('/clients');
            } else {
                const data = await response.json();
                alert(`❌ Erro: ${data.error || 'Erro ao cadastrar'}`);
            }
        } catch (error: any) {
            alert(`❌ Erro: ${error.message || 'Erro ao cadastrar'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout
            title="Novo Cliente"
            subtitle="Cadastre um novo lead manualmente"
            icon="➕"
        >
            <Card>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.section}>
                        <h3>📋 Dados do Cliente</h3>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Nome *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Nome do estabelecimento"
                                    required
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Categoria</label>
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Restaurante">Restaurante</option>
                                    <option value="Lanchonete">Lanchonete</option>
                                    <option value="Pizzaria">Pizzaria</option>
                                    <option value="Padaria">Padaria</option>
                                    <option value="Hamburgueria">Hamburgueria</option>
                                    <option value="Japonês">Japonês</option>
                                    <option value="Árabe">Árabe</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Telefone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contato@email.com"
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3>📍 Endereço</h3>
                        <div className={styles.row}>
                            <div className={styles.field} style={{ flex: 3 }}>
                                <label>Rua</label>
                                <input
                                    type="text"
                                    value={formData.street}
                                    onChange={e => setFormData({ ...formData, street: e.target.value })}
                                    placeholder="Rua, Avenida, etc."
                                />
                            </div>
                            <div className={styles.field} style={{ flex: 1 }}>
                                <label>Número</label>
                                <input
                                    type="text"
                                    value={formData.number}
                                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                                    placeholder="123"
                                />
                            </div>
                        </div>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Bairro</label>
                                <input
                                    type="text"
                                    value={formData.neighborhood}
                                    onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                                    placeholder="Bairro"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Cidade *</label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="Cidade"
                                    required
                                />
                            </div>
                        </div>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Estado</label>
                                <input
                                    type="text"
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                                    placeholder="SP"
                                    maxLength={2}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>CEP</label>
                                <input
                                    type="text"
                                    value={formData.zip}
                                    onChange={e => setFormData({ ...formData, zip: e.target.value })}
                                    placeholder="00000-000"
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3>📝 Observações</h3>
                        <div className={styles.field}>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Observações sobre o cliente..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <Button
                            variant="ghost"
                            onClick={() => router.back()}
                        >
                            ← Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => { }}
                            disabled={loading}
                        >
                            {loading ? '⏳ Salvando...' : '✓ Cadastrar Cliente'}
                        </Button>
                    </div>
                </form>
            </Card>
        </PageLayout>
    );
}
