'use client';

import { useState } from 'react';
import styles from './campaigns-simple.module.css';

interface Lead {
    id: string;
    name: string;
    city?: string;
    status: string;
}

interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'whatsapp' | 'ligacao';
    message: string;
    status: 'rascunho' | 'enviada';
    leadsCount: number;
    createdAt: string;
}

interface Props {
    initialCampaigns?: Campaign[];
    availableLeads?: Lead[];
}

export default function CampaignsClientSimple({ initialCampaigns = [], availableLeads = [] }: Props) {
    const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ name: '', type: 'email', message: '', selectedLeads: [] as string[] });
    const [search, setSearch] = useState('');

    const filteredLeads = availableLeads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

    const handleSave = () => {
        setCampaigns(prev => [{
            id: Date.now().toString(),
            name: form.name,
            type: form.type as any,
            message: form.message,
            status: 'rascunho',
            leadsCount: form.selectedLeads.length,
            createdAt: new Date().toISOString()
        }, ...prev]);
        setShowModal(false);
        setForm({ name: '', type: 'email', message: '', selectedLeads: [] });
        setStep(1);
    };

    const markSent = (id: string) => setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'enviada' as const } : c));
    const del = (id: string) => confirm('Excluir?') && setCampaigns(prev => prev.filter(c => c.id !== id));

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div><h1>📧 Campanhas</h1><p>Comunicação com leads</p></div>
                <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>+ Nova</button>
            </header>

            <div className={styles.stats}>
                <div className={styles.stat}><b>{campaigns.length}</b><span>Total</span></div>
                <div className={styles.stat}><b>{campaigns.filter(c => c.status === 'rascunho').length}</b><span>Rascunhos</span></div>
                <div className={styles.stat}><b>{campaigns.filter(c => c.status === 'enviada').length}</b><span>Enviadas</span></div>
            </div>

            {campaigns.length === 0 ? (
                <div className={styles.empty}><p>Nenhuma campanha</p></div>
            ) : (
                <div className={styles.list}>
                    {campaigns.map(c => (
                        <div key={c.id} className={styles.card}>
                            <div className={styles.cardTop}>
                                <h3>{c.type === 'email' ? '📧' : c.type === 'whatsapp' ? '💬' : '📞'} {c.name}</h3>
                                <span className={c.status === 'enviada' ? styles.sent : styles.draft}>
                                    {c.status === 'enviada' ? '✅ Enviada' : '📝 Rascunho'}
                                </span>
                            </div>
                            <p>{c.message.substring(0, 100)}...</p>
                            <div className={styles.cardMeta}>{c.leadsCount} leads • {new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
                            <div className={styles.cardActions}>
                                {c.status === 'rascunho' && <button onClick={() => markSent(c.id)}>✅ Marcar Enviada</button>}
                                <button onClick={() => del(c.id)}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className={styles.overlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2>Nova Campanha - Passo {step}/3</h2>
                        
                        {step === 1 && (
                            <>
                                <input placeholder="Nome da campanha" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
                                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}>
                                    <option value="email">📧 Email</option>
                                    <option value="whatsapp">💬 WhatsApp</option>
                                    <option value="ligacao">📞 Ligação</option>
                                </select>
                                <button disabled={!form.name} onClick={() => setStep(2)}>Próximo →</button>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                                <div className={styles.leadsList}>
                                    {filteredLeads.map(l => (
                                        <label key={l.id}>
                                            <input type="checkbox" checked={form.selectedLeads.includes(l.id)} 
                                                onChange={() => setForm(p => ({...p, selectedLeads: p.selectedLeads.includes(l.id) ? p.selectedLeads.filter(x=>x!==l.id) : [...p.selectedLeads, l.id]}))} />
                                            {l.name}
                                        </label>
                                    ))}
                                </div>
                                <p>{form.selectedLeads.length} selecionados</p>
                                <button onClick={() => setStep(1)}>← Voltar</button>
                                <button disabled={!form.selectedLeads.length} onClick={() => setStep(3)}>Próximo →</button>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <textarea placeholder="Sua mensagem..." value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} rows={6} />
                                <button onClick={() => setStep(2)}>← Voltar</button>
                                <button disabled={!form.message} onClick={handleSave}>💾 Salvar</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
