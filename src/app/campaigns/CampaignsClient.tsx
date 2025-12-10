'use client';

import { useState } from 'react';
import styles from './page.module.css';
import {
    getCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    completeCampaign,
    generateCampaignContentWithAI,
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    applyTemplateToCampaign
} from './actions';
import {
    getWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    executeWorkflow
} from './workflow-actions';
// Removido import de db-data - dados vêm do servidor

interface Campaign {
    id: string;
    name: string;
    description?: string | null;
    type: string;
    status: string;
    subject?: string | null;
    content?: string | null;
    scheduledAt?: string | null;
    totalRecipients: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    convertedCount: number;
    segmentCriteria?: any;
    createdAt: string;
    recipientsCount: number;
}

interface CampaignsClientProps {
    initialCampaigns?: Campaign[];
    initialWorkflows?: any[];
    initialTemplates?: any[];
    initialSellers?: any[];
}

export default function CampaignsClient({
    initialCampaigns = [],
    initialWorkflows = [],
    initialTemplates = [],
    initialSellers = []
}: CampaignsClientProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
    const [workflows, setWorkflows] = useState<any[]>(initialWorkflows);
    const [templates, setTemplates] = useState<any[]>(initialTemplates);
    const [sellers, setSellers] = useState<any[]>(initialSellers);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'campaigns' | 'workflows' | 'templates'>('campaigns');
    const [showModal, setShowModal] = useState(false);
    const [showWorkflowModal, setShowWorkflowModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [editingWorkflow, setEditingWorkflow] = useState<any | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'completed'>('all');

    // Campaign Form
    const [campaignForm, setCampaignForm] = useState({
        name: '',
        description: '',
        type: 'email' as 'email' | 'sms' | 'linkedin',
        subject: '',
        content: '',
        scheduledAt: '',
        segmentCriteria: {
            status: [] as string[],
            potential: [] as string[],
            city: [] as string[],
            seller: [] as string[]
        },
        autoFollowUp: false,
        followUpDays: 7,
        aiGenerated: false,
        aiPrompt: '',
        templateId: ''
    });

    // Template Form
    const [templateForm, setTemplateForm] = useState({
        name: '',
        subject: '',
        content: '',
        category: 'custom' as 'prospecting' | 'follow_up' | 're_engagement' | 'custom',
        variables: [] as string[],
        isDefault: false
    });

    // Workflow Form
    const [workflowForm, setWorkflowForm] = useState({
        name: '',
        description: '',
        triggerType: 'new_lead' as 'status_change' | 'new_lead' | 'no_contact_days' | 'rating_threshold' | 'manual',
        triggerConditions: {
            status: [] as string[],
            potential: [] as string[],
            minRating: 4.0,
            daysWithoutContact: 30
        },
        steps: [] as any[],
        active: true
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [campaignsData, workflowsData, templatesData] = await Promise.all([
                getCampaigns(),
                getWorkflows(),
                getEmailTemplates()
            ]);
            setCampaigns(campaignsData);
            setWorkflows(workflowsData);
            setTemplates(templatesData);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        setLoading(true);
        try {
            const result = await createCampaign({
                ...campaignForm,
                status: 'draft'
            });

            if (result.success) {
                setShowModal(false);
                resetCampaignForm();
                loadData();
            }
        } catch (error) {
            console.error('Erro ao criar campanha:', error);
            alert('Erro ao criar campanha');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTemplate = async () => {
        setLoading(true);
        try {
            let result;
            if (editingTemplate) {
                result = await updateEmailTemplate(editingTemplate.id, templateForm);
            } else {
                result = await createEmailTemplate(templateForm);
            }

            if (result.success) {
                setShowTemplateModal(false);
                resetTemplateForm();
                loadData();
            }
        } catch (error) {
            console.error('Erro ao salvar template:', error);
            alert('Erro ao salvar template');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        setLoading(true);
        try {
            let result;
            if (editingWorkflow) {
                result = await updateWorkflow(editingWorkflow.id, workflowForm);
            } else {
                result = await createWorkflow(workflowForm);
            }

            if (result.success) {
                setShowWorkflowModal(false);
                resetWorkflowForm();
                loadData();
            }
        } catch (error) {
            console.error('Erro ao salvar workflow:', error);
            alert('Erro ao salvar workflow');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Deseja deletar este template?')) return;

        setLoading(true);
        try {
            await deleteEmailTemplate(id);
            loadData();
        } catch (error) {
            console.error('Erro ao deletar template:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorkflow = async (id: string) => {
        if (!confirm('Deseja deletar este workflow?')) return;

        setLoading(true);
        try {
            await deleteWorkflow(id);
            loadData();
        } catch (error) {
            console.error('Erro ao deletar workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleWorkflow = async (id: string, currentActive: boolean) => {
        setLoading(true);
        try {
            await updateWorkflow(id, { active: !currentActive });
            loadData();
        } catch (error) {
            console.error('Erro ao atualizar workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyTemplate = async (campaignId: string, templateId: string) => {
        setLoading(true);
        try {
            const result = await applyTemplateToCampaign(campaignId, templateId);
            if (result.success) {
                loadData();
                alert('Template aplicado com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao aplicar template:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateWithAI = async () => {
        setLoading(true);
        try {
            const result = await generateCampaignContentWithAI(campaignForm.aiPrompt);
            if (result.success && result.content) {
                setCampaignForm(prev => ({
                    ...prev,
                    content: (result.content as any).body || (result.content as any),
                    subject: (result.content as any).subject || prev.subject || 'Proposta Personalizada',
                    aiGenerated: true
                }));
            }
        } catch (error) {
            console.error('Erro ao gerar com IA:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartCampaign = async (id: string) => {
        if (!confirm('Deseja iniciar esta campanha?')) return;

        setLoading(true);
        try {
            await startCampaign(id);
            loadData();
        } catch (error) {
            console.error('Erro ao iniciar campanha:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm('Deseja deletar esta campanha?')) return;

        setLoading(true);
        try {
            await deleteCampaign(id);
            loadData();
        } catch (error) {
            console.error('Erro ao deletar campanha:', error);
        } finally {
            setLoading(false);
        }
    };

    const addWorkflowStep = () => {
        setWorkflowForm(prev => ({
            ...prev,
            steps: [...prev.steps, {
                type: 'send_email',
                delay: 0,
                config: {}
            }]
        }));
    };

    const removeWorkflowStep = (index: number) => {
        setWorkflowForm(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const updateWorkflowStep = (index: number, field: string, value: any) => {
        setWorkflowForm(prev => ({
            ...prev,
            steps: prev.steps.map((step, i) =>
                i === index ? { ...step, [field]: value } : step
            )
        }));
    };

    const resetCampaignForm = () => {
        setCampaignForm({
            name: '',
            description: '',
            type: 'email',
            subject: '',
            content: '',
            scheduledAt: '',
            segmentCriteria: {
                status: [],
                potential: [],
                city: [],
                seller: []
            },
            autoFollowUp: false,
            followUpDays: 7,
            aiGenerated: false,
            aiPrompt: '',
            templateId: ''
        });
        setEditingCampaign(null);
    };

    const resetTemplateForm = () => {
        setTemplateForm({
            name: '',
            subject: '',
            content: '',
            category: 'custom',
            variables: [],
            isDefault: false
        });
        setEditingTemplate(null);
    };

    const resetWorkflowForm = () => {
        setWorkflowForm({
            name: '',
            description: '',
            triggerType: 'new_lead',
            triggerConditions: {
                status: [],
                potential: [],
                minRating: 4.0,
                daysWithoutContact: 30
            },
            steps: [],
            active: true
        });
        setEditingWorkflow(null);
    };

    const filteredCampaigns = campaigns.filter(c => {
        if (filter === 'all') return true;
        return c.status === filter;
    });

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { label: string; class: string }> = {
            draft: { label: '📝 Rascunho', class: styles.statusDraft },
            scheduled: { label: '⏰ Agendada', class: styles.statusScheduled },
            active: { label: '🟢 Ativa', class: styles.statusActive },
            paused: { label: '⏸️ Pausada', class: styles.statusPaused },
            completed: { label: '✅ Concluída', class: styles.statusCompleted },
            cancelled: { label: '❌ Cancelada', class: styles.statusCancelled }
        };
        return badges[status] || badges.draft;
    };

    const getConversionRate = (campaign: Campaign) => {
        if (campaign.sentCount === 0) return 0;
        return ((campaign.convertedCount / campaign.sentCount) * 100).toFixed(1);
    };

    // Dados vêm do servidor, não precisa de loading inicial

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>📣 Campanhas & Automação</h1>
                    <p>Gerencie campanhas de marketing e workflows automatizados</p>
                </div>
                <div className={styles.headerActions}>
                    {activeTab === 'campaigns' && (
                        <button
                            className={styles.newButton}
                            onClick={() => {
                                resetCampaignForm();
                                setShowModal(true);
                            }}
                        >
                            + Nova Campanha
                        </button>
                    )}
                    {activeTab === 'workflows' && (
                        <button
                            className={styles.newButton}
                            onClick={() => {
                                resetWorkflowForm();
                                setShowWorkflowModal(true);
                            }}
                        >
                            + Novo Workflow
                        </button>
                    )}
                    {activeTab === 'templates' && (
                        <button
                            className={styles.newButton}
                            onClick={() => {
                                resetTemplateForm();
                                setShowTemplateModal(true);
                            }}
                        >
                            + Novo Template
                        </button>
                    )}
                </div>
            </header>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'campaigns' ? styles.active : ''}`}
                    onClick={() => setActiveTab('campaigns')}
                >
                    📧 Campanhas ({campaigns.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'workflows' ? styles.active : ''}`}
                    onClick={() => setActiveTab('workflows')}
                >
                    ⚙️ Workflows ({workflows.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'templates' ? styles.active : ''}`}
                    onClick={() => setActiveTab('templates')}
                >
                    📄 Templates ({templates.length})
                </button>
            </div>

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
                <>
                    <div className={styles.filters}>
                        <button
                            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            Todas
                        </button>
                        <button
                            className={`${styles.filterBtn} ${filter === 'active' ? styles.active : ''}`}
                            onClick={() => setFilter('active')}
                        >
                            Ativas
                        </button>
                        <button
                            className={`${styles.filterBtn} ${filter === 'draft' ? styles.active : ''}`}
                            onClick={() => setFilter('draft')}
                        >
                            Rascunhos
                        </button>
                        <button
                            className={`${styles.filterBtn} ${filter === 'completed' ? styles.active : ''}`}
                            onClick={() => setFilter('completed')}
                        >
                            Concluídas
                        </button>
                    </div>

                    <div className={styles.campaignsGrid}>
                        {filteredCampaigns.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>Nenhuma campanha encontrada</p>
                                <button
                                    className={styles.newButton}
                                    onClick={() => {
                                        resetCampaignForm();
                                        setShowModal(true);
                                    }}
                                >
                                    Criar Primeira Campanha
                                </button>
                            </div>
                        ) : (
                            filteredCampaigns.map(campaign => {
                                const statusBadge = getStatusBadge(campaign.status);
                                const conversionRate = getConversionRate(campaign);

                                return (
                                    <div key={campaign.id} className={styles.campaignCard}>
                                        <div className={styles.campaignHeader}>
                                            <div>
                                                <h3>{campaign.name}</h3>
                                                <span className={`${styles.statusBadge} ${statusBadge.class}`}>
                                                    {statusBadge.label}
                                                </span>
                                            </div>
                                            <div className={styles.campaignActions}>
                                                {campaign.status === 'draft' && (
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => handleStartCampaign(campaign.id)}
                                                    >
                                                        ▶️ Iniciar
                                                    </button>
                                                )}
                                                {campaign.status === 'active' && (
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={async () => {
                                                            await pauseCampaign(campaign.id);
                                                            loadData();
                                                        }}
                                                    >
                                                        ⏸️ Pausar
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDeleteCampaign(campaign.id)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        {campaign.description && (
                                            <p className={styles.campaignDescription}>{campaign.description}</p>
                                        )}

                                        <div className={styles.campaignMetrics}>
                                            <div className={styles.metric}>
                                                <span className={styles.metricValue}>{campaign.totalRecipients}</span>
                                                <span className={styles.metricLabel}>Destinatários</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricValue}>{campaign.sentCount}</span>
                                                <span className={styles.metricLabel}>Enviados</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricValue}>{campaign.openedCount}</span>
                                                <span className={styles.metricLabel}>Abertos</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricValue}>{campaign.clickedCount}</span>
                                                <span className={styles.metricLabel}>Cliques</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricValue}>{conversionRate}%</span>
                                                <span className={styles.metricLabel}>Conversão</span>
                                            </div>
                                        </div>

                                        <div className={styles.campaignFooter}>
                                            <span className={styles.campaignType}>
                                                {campaign.type === 'email' ? '📧' :
                                                    campaign.type === 'sms' ? '📱' : '💼'} {campaign.type}
                                            </span>
                                            <span className={styles.campaignDate}>
                                                {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* Workflows Tab */}
            {activeTab === 'workflows' && (
                <div className={styles.workflowsList}>
                    {workflows.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Nenhum workflow criado</p>
                            <button
                                className={styles.newButton}
                                onClick={() => {
                                    resetWorkflowForm();
                                    setShowWorkflowModal(true);
                                }}
                            >
                                Criar Primeiro Workflow
                            </button>
                        </div>
                    ) : (
                        workflows.map(workflow => (
                            <div key={workflow.id} className={styles.workflowCard}>
                                <div className={styles.workflowHeader}>
                                    <div>
                                        <h3>{workflow.name}</h3>
                                        <span className={workflow.active ? styles.activeBadge : styles.inactiveBadge}>
                                            {workflow.active ? '🟢 Ativo' : '⚫ Inativo'}
                                        </span>
                                    </div>
                                    <div className={styles.workflowActions}>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleToggleWorkflow(workflow.id, workflow.active)}
                                        >
                                            {workflow.active ? '⏸️ Desativar' : '▶️ Ativar'}
                                        </button>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => {
                                                setEditingWorkflow(workflow);
                                                setWorkflowForm({
                                                    name: workflow.name,
                                                    description: workflow.description || '',
                                                    triggerType: workflow.triggerType,
                                                    triggerConditions: workflow.triggerConditions || {},
                                                    steps: workflow.steps || [],
                                                    active: workflow.active
                                                });
                                                setShowWorkflowModal(true);
                                            }}
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDeleteWorkflow(workflow.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                {workflow.description && (
                                    <p className={styles.workflowDescription}>{workflow.description}</p>
                                )}
                                <div className={styles.workflowInfo}>
                                    <span>🔔 Trigger: {workflow.triggerType}</span>
                                    <span>⚙️ Execuções: {workflow.executionCount}</span>
                                    <span>📋 Steps: {workflow.steps?.length || 0}</span>
                                    {workflow.lastExecutedAt && (
                                        <span>🕐 Última: {new Date(workflow.lastExecutedAt).toLocaleDateString('pt-BR')}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className={styles.templatesList}>
                    {templates.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Nenhum template criado</p>
                            <button
                                className={styles.newButton}
                                onClick={() => {
                                    resetTemplateForm();
                                    setShowTemplateModal(true);
                                }}
                            >
                                Criar Primeiro Template
                            </button>
                        </div>
                    ) : (
                        templates.map(template => (
                            <div key={template.id} className={styles.templateCard}>
                                <div className={styles.templateHeader}>
                                    <div>
                                        <h3>{template.name}</h3>
                                        {template.isDefault && (
                                            <span className={styles.defaultBadge}>⭐ Padrão</span>
                                        )}
                                    </div>
                                    <div className={styles.templateActions}>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => {
                                                setEditingTemplate(template);
                                                setTemplateForm({
                                                    name: template.name,
                                                    subject: template.subject || '',
                                                    content: template.content,
                                                    category: template.category || 'custom',
                                                    variables: template.variables || [],
                                                    isDefault: template.isDefault
                                                });
                                                setShowTemplateModal(true);
                                            }}
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDeleteTemplate(template.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <p className={styles.templateCategory}>
                                    {template.category === 'prospecting' ? '🎯 Prospecção' :
                                        template.category === 'follow_up' ? '📞 Follow-up' :
                                            template.category === 're_engagement' ? '🔄 Reativação' :
                                                '📝 Personalizado'}
                                </p>
                                <p className={styles.templateSubject}>{template.subject || 'Sem assunto'}</p>
                                <p className={styles.templatePreview}>
                                    {template.content.substring(0, 150)}...
                                </p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Create Campaign Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingCampaign ? 'Editar' : 'Nova'} Campanha</h2>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Nome da Campanha *</label>
                                <input
                                    type="text"
                                    value={campaignForm.name}
                                    onChange={e => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Prospecção Q1 2025"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Descrição</label>
                                <textarea
                                    value={campaignForm.description}
                                    onChange={e => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Descreva o objetivo da campanha..."
                                    rows={2}
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Tipo *</label>
                                    <select
                                        value={campaignForm.type}
                                        onChange={e => setCampaignForm(prev => ({ ...prev, type: e.target.value as any }))}
                                    >
                                        <option value="email">📧 Email</option>
                                        <option value="sms">📱 SMS</option>
                                        <option value="linkedin">💼 LinkedIn</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Template (opcional)</label>
                                    <select
                                        value={campaignForm.templateId}
                                        onChange={e => {
                                            const templateId = e.target.value;
                                            setCampaignForm(prev => ({ ...prev, templateId }));
                                            if (templateId) {
                                                const template = templates.find(t => t.id === templateId);
                                                if (template) {
                                                    setCampaignForm(prev => ({
                                                        ...prev,
                                                        subject: template.subject || prev.subject,
                                                        content: template.content
                                                    }));
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Selecione um template...</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Assunto *</label>
                                <input
                                    type="text"
                                    value={campaignForm.subject}
                                    onChange={e => setCampaignForm(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Assunto do email"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Conteúdo *</label>
                                <div className={styles.aiSection}>
                                    <textarea
                                        value={campaignForm.content}
                                        onChange={e => setCampaignForm(prev => ({ ...prev, content: e.target.value }))}
                                        placeholder="Digite o conteúdo ou use IA para gerar..."
                                        rows={8}
                                    />
                                    <div className={styles.aiControls}>
                                        <input
                                            type="text"
                                            value={campaignForm.aiPrompt}
                                            onChange={e => setCampaignForm(prev => ({ ...prev, aiPrompt: e.target.value }))}
                                            placeholder="Descreva o que você quer que a IA gere..."
                                            className={styles.aiInput}
                                        />
                                        <button
                                            className={styles.aiButton}
                                            onClick={handleGenerateWithAI}
                                            disabled={!campaignForm.aiPrompt.trim() || loading}
                                        >
                                            🤖 Gerar com IA
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Segmentação</label>
                                <div className={styles.segmentation}>
                                    <div>
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={campaignForm.segmentCriteria.status.includes('Qualificado')}
                                                onChange={e => {
                                                    const status = campaignForm.segmentCriteria.status;
                                                    if (e.target.checked) {
                                                        setCampaignForm(prev => ({
                                                            ...prev,
                                                            segmentCriteria: {
                                                                ...prev.segmentCriteria,
                                                                status: [...status, 'Qualificado']
                                                            }
                                                        }));
                                                    } else {
                                                        setCampaignForm(prev => ({
                                                            ...prev,
                                                            segmentCriteria: {
                                                                ...prev.segmentCriteria,
                                                                status: status.filter(s => s !== 'Qualificado')
                                                            }
                                                        }));
                                                    }
                                                }}
                                            />
                                            Status: Qualificado
                                        </label>
                                    </div>
                                    <div>
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={campaignForm.segmentCriteria.potential.includes('ALTISSIMO')}
                                                onChange={e => {
                                                    const potential = campaignForm.segmentCriteria.potential;
                                                    if (e.target.checked) {
                                                        setCampaignForm(prev => ({
                                                            ...prev,
                                                            segmentCriteria: {
                                                                ...prev.segmentCriteria,
                                                                potential: [...potential, 'ALTISSIMO']
                                                            }
                                                        }));
                                                    } else {
                                                        setCampaignForm(prev => ({
                                                            ...prev,
                                                            segmentCriteria: {
                                                                ...prev.segmentCriteria,
                                                                potential: potential.filter(p => p !== 'ALTISSIMO')
                                                            }
                                                        }));
                                                    }
                                                }}
                                            />
                                            Potencial: Altíssimo
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={campaignForm.autoFollowUp}
                                        onChange={e => setCampaignForm(prev => ({ ...prev, autoFollowUp: e.target.checked }))}
                                    />
                                    Criar follow-up automático após {campaignForm.followUpDays} dias
                                </label>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmBtn}
                                onClick={handleCreateCampaign}
                                disabled={!campaignForm.name || !campaignForm.subject || !campaignForm.content || loading}
                            >
                                {loading ? 'Salvando...' : 'Salvar Campanha'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Template Modal */}
            {showTemplateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowTemplateModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingTemplate ? 'Editar' : 'Novo'} Template</h2>
                            <button className={styles.closeBtn} onClick={() => setShowTemplateModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Nome do Template *</label>
                                <input
                                    type="text"
                                    value={templateForm.name}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Prospecção Inicial"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Categoria</label>
                                    <select
                                        value={templateForm.category}
                                        onChange={e => setTemplateForm(prev => ({ ...prev, category: e.target.value as any }))}
                                    >
                                        <option value="prospecting">🎯 Prospecção</option>
                                        <option value="follow_up">📞 Follow-up</option>
                                        <option value="re_engagement">🔄 Reativação</option>
                                        <option value="custom">📝 Personalizado</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={templateForm.isDefault}
                                            onChange={e => setTemplateForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                                        />
                                        Template Padrão
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Assunto *</label>
                                <input
                                    type="text"
                                    value={templateForm.subject}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Assunto do email"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Conteúdo *</label>
                                <textarea
                                    value={templateForm.content}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="Conteúdo do template. Use {{nome}}, {{cidade}}, etc para variáveis..."
                                    rows={10}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                    Variáveis disponíveis: {'{'}nome{'}'}, {'{'}cidade{'}'}, {'{'}rating{'}'}, {'{'}status{'}'}
                                </small>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowTemplateModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmBtn}
                                onClick={handleCreateTemplate}
                                disabled={!templateForm.name || !templateForm.content || loading}
                            >
                                {loading ? 'Salvando...' : editingTemplate ? 'Atualizar' : 'Criar Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Workflow Modal */}
            {showWorkflowModal && (
                <div className={styles.modalOverlay} onClick={() => setShowWorkflowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingWorkflow ? 'Editar' : 'Novo'} Workflow</h2>
                            <button className={styles.closeBtn} onClick={() => setShowWorkflowModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Nome do Workflow *</label>
                                <input
                                    type="text"
                                    value={workflowForm.name}
                                    onChange={e => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Follow-up Automático para Hot Leads"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Descrição</label>
                                <textarea
                                    value={workflowForm.description}
                                    onChange={e => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Descreva o objetivo do workflow..."
                                    rows={2}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Trigger (Quando executar) *</label>
                                <select
                                    value={workflowForm.triggerType}
                                    onChange={e => setWorkflowForm(prev => ({ ...prev, triggerType: e.target.value as any }))}
                                >
                                    <option value="new_lead">🆕 Novo Lead Criado</option>
                                    <option value="status_change">🔄 Mudança de Status</option>
                                    <option value="no_contact_days">⏰ Sem Contato há X Dias</option>
                                    <option value="rating_threshold">⭐ Rating Acima de X</option>
                                    <option value="manual">👤 Manual</option>
                                </select>
                            </div>

                            {workflowForm.triggerType === 'no_contact_days' && (
                                <div className={styles.formGroup}>
                                    <label>Dias sem contato</label>
                                    <input
                                        type="number"
                                        value={workflowForm.triggerConditions.daysWithoutContact}
                                        onChange={e => setWorkflowForm(prev => ({
                                            ...prev,
                                            triggerConditions: {
                                                ...prev.triggerConditions,
                                                daysWithoutContact: parseInt(e.target.value) || 30
                                            }
                                        }))}
                                        min="1"
                                    />
                                </div>
                            )}

                            {workflowForm.triggerType === 'rating_threshold' && (
                                <div className={styles.formGroup}>
                                    <label>Rating mínimo</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={workflowForm.triggerConditions.minRating}
                                        onChange={e => setWorkflowForm(prev => ({
                                            ...prev,
                                            triggerConditions: {
                                                ...prev.triggerConditions,
                                                minRating: parseFloat(e.target.value) || 4.0
                                            }
                                        }))}
                                        min="0"
                                        max="5"
                                    />
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label>Steps (Ações) *</label>
                                <div className={styles.workflowSteps}>
                                    {workflowForm.steps.map((step, index) => (
                                        <div key={index} className={styles.workflowStep}>
                                            <div className={styles.stepHeader}>
                                                <span className={styles.stepNumber}>Step {index + 1}</span>
                                                <button
                                                    className={styles.removeStepBtn}
                                                    onClick={() => removeWorkflowStep(index)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className={styles.formRow}>
                                                <div className={styles.formGroup}>
                                                    <label>Tipo de Ação</label>
                                                    <select
                                                        value={step.type}
                                                        onChange={e => updateWorkflowStep(index, 'type', e.target.value)}
                                                    >
                                                        <option value="send_email">📧 Enviar Email</option>
                                                        <option value="create_followup">📅 Criar Follow-up</option>
                                                        <option value="assign_seller">👤 Atribuir Executivo</option>
                                                        <option value="update_status">🔄 Atualizar Status</option>
                                                        <option value="create_note">📝 Criar Nota</option>
                                                    </select>
                                                </div>
                                                <div className={styles.formGroup}>
                                                    <label>Delay (dias)</label>
                                                    <input
                                                        type="number"
                                                        value={step.delay || 0}
                                                        onChange={e => updateWorkflowStep(index, 'delay', parseInt(e.target.value) || 0)}
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            {step.type === 'update_status' && (
                                                <div className={styles.formGroup}>
                                                    <label>Novo Status</label>
                                                    <select
                                                        value={step.config?.status || 'Contatado'}
                                                        onChange={e => updateWorkflowStep(index, 'config', { ...step.config, status: e.target.value })}
                                                    >
                                                        <option value="Qualificado">Qualificado</option>
                                                        <option value="Contatado">Contatado</option>
                                                        <option value="Negociação">Negociação</option>
                                                        <option value="Fechado">Fechado</option>
                                                    </select>
                                                </div>
                                            )}
                                            {step.type === 'create_followup' && (
                                                <div className={styles.formGroup}>
                                                    <label>Notas do Follow-up</label>
                                                    <textarea
                                                        value={step.config?.notes || ''}
                                                        onChange={e => updateWorkflowStep(index, 'config', { ...step.config, notes: e.target.value })}
                                                        rows={2}
                                                        placeholder="Notas automáticas..."
                                                    />
                                                </div>
                                            )}
                                            {step.type === 'assign_seller' && (
                                                <div className={styles.formGroup}>
                                                    <label>Executivo</label>
                                                    <select
                                                        value={step.config?.sellerId || ''}
                                                        onChange={e => updateWorkflowStep(index, 'config', { ...step.config, sellerId: e.target.value })}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {sellers.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            {step.type === 'create_note' && (
                                                <div className={styles.formGroup}>
                                                    <label>Conteúdo da Nota</label>
                                                    <textarea
                                                        value={step.config?.content || ''}
                                                        onChange={e => updateWorkflowStep(index, 'config', { ...step.config, content: e.target.value })}
                                                        rows={2}
                                                        placeholder="Conteúdo da nota automática..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        className={styles.addStepBtn}
                                        onClick={addWorkflowStep}
                                    >
                                        + Adicionar Step
                                    </button>
                                </div>
                            </div>

                            {workflowForm.steps.length === 0 && (
                                <button
                                    className={styles.addStepBtn}
                                    onClick={addWorkflowStep}
                                >
                                    + Adicionar Primeiro Step
                                </button>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={workflowForm.active}
                                        onChange={e => setWorkflowForm(prev => ({ ...prev, active: e.target.checked }))}
                                    />
                                    Workflow Ativo
                                </label>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowWorkflowModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmBtn}
                                onClick={handleCreateWorkflow}
                                disabled={!workflowForm.name || workflowForm.steps.length === 0 || loading}
                            >
                                {loading ? 'Salvando...' : editingWorkflow ? 'Atualizar' : 'Criar Workflow'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
