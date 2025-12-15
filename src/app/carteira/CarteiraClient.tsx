'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { scheduleVisit, updateClientPriority, updateClientStatus, addNote, autoFillWeeklySchedule, exportWeeklyScheduleToExcel, getWeeklySchedule, exportWeeklyScheduleToAgendamentoTemplate } from './actions';
import { exportRestaurantsToCheckmob } from '@/app/actions';
import { analyzeIntelligentFill, type FillSuggestion, type UserDecision } from './actions-intelligent';
import WeeklyCalendar from './WeeklyCalendar';
import MapaTecnologico from './MapaTecnologico';
import FixedClientsSection from './FixedClientsSection';
import ConfirmationModal from './ConfirmationModal';

interface ScheduledSlot {
    id: string;
    restaurantId: string;
    restaurantName: string;
    time: string;
    date: string;
}

interface Seller {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    zonas: string[]; // Áreas de cobertura (cidades) - substitui zonas CEP
    active: boolean;
}

interface Restaurant {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
    address: any;
    status: string;
    salesPotential: string | null;
    projectedDeliveries: number;
    sellerId: string | null;
    sellerName: string | null;
    commentsCount: number;
    createdAt: string;
    assignedAt: string | null;
}

interface FollowUp {
    id: string;
    restaurantId: string;
    type: string;
    scheduledDate: string;
    notes: string | null;
}

interface Visit {
    id: string;
    restaurantId: string;
    sellerId: string;
    visitDate: string;
    feedback: string | null;
    outcome: string | null;
    nextVisitDate: string | null;
}

interface Props {
    initialData: {
        sellers: Seller[];
        restaurants: Restaurant[];
        followUps: FollowUp[];
        visits: Visit[];
    };
}

type ViewMode = 'cards' | 'list' | 'calendar';
type FilterPeriod = 'week' | 'month' | 'all';

export default function CarteiraClient({ initialData }: Props) {
    const router = useRouter();
    const scrollPositionRef = useRef<number>(0);
    const { sellers, restaurants, followUps, visits } = initialData;
    
    const [selectedSellerId, setSelectedSellerId] = useState<string>(sellers[0]?.id || '');
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    // Estado de filtro de potencial - inicializar como função para evitar hydration mismatch
    // Usar useEffect para garantir que seja definido apenas no cliente
    const [filterPotential, setFilterPotential] = useState<string[]>([]);
    const [potentialDropdownOpen, setPotentialDropdownOpen] = useState<boolean>(false);
    
    // Inicializar filtro de potencial apenas no cliente para evitar hydration mismatch
    useEffect(() => {
        if (filterPotential.length === 0) {
            setFilterPotential(['ALTISSIMO', 'ALTO', 'MEDIO', 'BAIXO']);
        }
    }, []);
    const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [weekPlan, setWeekPlan] = useState<string[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
    const [scheduleData, setScheduleData] = useState({ date: '', time: '', notes: '' });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'carteira-padrao' | 'carteira' | 'semana' | 'agenda' | 'mapa' | 'exportar-checkmob' | 'exportar-agendamento' | 'clientes-fixos'>('carteira-padrao');
    const [weekViewMode, setWeekViewMode] = useState<'list' | 'calendar'>('calendar');
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    });
    
    // Quick View Modal
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    const [quickViewTab, setQuickViewTab] = useState<'info' | 'actions' | 'notes' | 'history'>('info');
    const [newNote, setNewNote] = useState('');
    const [editingStatus, setEditingStatus] = useState<string | null>(null);
    const [editingPriority, setEditingPriority] = useState<string | null>(null);
    
    // Exportar Checkmob - Estados
    const [checkmobSelectedRestaurants, setCheckmobSelectedRestaurants] = useState<Set<string>>(new Set());
    const [checkmobExporting, setCheckmobExporting] = useState(false);
    const [checkmobFilterSeller, setCheckmobFilterSeller] = useState<string>('all');
    const [checkmobFilterStatus, setCheckmobFilterStatus] = useState<string>('all');
    const [checkmobFilterPotential, setCheckmobFilterPotential] = useState<string[]>([]);
    const [checkmobFilterNeighborhood, setCheckmobFilterNeighborhood] = useState<string>('all');
    const [checkmobFilterCity, setCheckmobFilterCity] = useState<string>('all');
    const [checkmobFilterState, setCheckmobFilterState] = useState<string>('all');
    const [checkmobFilterHotLeads, setCheckmobFilterHotLeads] = useState<boolean>(false);
    const [checkmobPotentialDropdownOpen, setCheckmobPotentialDropdownOpen] = useState<boolean>(false);
    
    // Agendamentos da semana para o mapa
    const [weeklyScheduledSlots, setWeeklyScheduledSlots] = useState<ScheduledSlot[]>([]);
    
    // Estados para sistema de confirmação inteligente
    const [suggestions, setSuggestions] = useState<FillSuggestion[]>([]);
    const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState<number>(-1);
    const [userDecisions, setUserDecisions] = useState<UserDecision[]>([]);

    // Carregar agendamentos da semana
    const loadWeeklySchedule = useCallback(async () => {
        if (!selectedSellerId) return;
        
        try {
            const schedule = await getWeeklySchedule(selectedSellerId, currentWeekStart.toISOString());
            setWeeklyScheduledSlots(schedule);
        } catch (error) {
            console.error('Erro ao carregar agenda da semana:', error);
        }
    }, [selectedSellerId, currentWeekStart]);

    // Carregar agendamentos quando executivo ou semana mudar
    useEffect(() => {
        loadWeeklySchedule();
    }, [loadWeeklySchedule]);

    // Fechar dropdown de potencial ao clicar fora (Checkmob)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(`.${styles.dropdownContainer}`)) {
                setCheckmobPotentialDropdownOpen(false);
            }
        };

        if (checkmobPotentialDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [checkmobPotentialDropdownOpen]);

    // Fechar dropdown de potencial ao clicar fora (Filtro Principal)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(`.${styles.potentialFilterDropdown}`)) {
                setPotentialDropdownOpen(false);
            }
        };

        if (potentialDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [potentialDropdownOpen]);

    // Executivo selecionado
    const selectedSeller = sellers.find(s => s.id === selectedSellerId);

    // Filtrar restaurantes da carteira do executivo
    const carteiraRestaurants = useMemo(() => {
        if (!selectedSeller) return [];

        return restaurants.filter(r => {
            // Verifica se o restaurante está atribuído ao executivo
            if (r.sellerId === selectedSellerId) return true;

            // Com o novo sistema de zonas, os restaurantes já são atribuídos automaticamente
            // baseado na zona, então não precisamos mais filtrar por bairro/cidade
            // Apenas retornar os restaurantes atribuídos ao executivo
            return false;
        });
    }, [restaurants, selectedSellerId, selectedSeller]);

    // Aplicar filtros
    const filteredRestaurants = useMemo(() => {
        return carteiraRestaurants.filter(r => {
            // Filtro de busca
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (!r.name.toLowerCase().includes(search) &&
                    !r.address?.neighborhood?.toLowerCase().includes(search) &&
                    !r.address?.city?.toLowerCase().includes(search)) {
                    return false;
                }
            }

            // Filtro de status
            if (filterStatus !== 'all' && r.status !== filterStatus) return false;

            // Filtro de potencial (múltipla escolha)
            // Se nenhum estiver selecionado OU se o array estiver vazio, mostrar todos (equivalente a "Todos")
            // Se houver seleções, verificar se o potencial do restaurante está na lista
            if (filterPotential.length > 0 && filterPotential.length < 4 && !filterPotential.includes(r.salesPotential || '')) return false;

            return true;
        });
    }, [carteiraRestaurants, searchTerm, filterStatus, filterPotential]);

    // Restaurantes no plano da semana
    const weekPlanRestaurants = filteredRestaurants.filter(r => weekPlan.includes(r.id));
    
    // Filtros para exportação Checkmob - extrair valores únicos
    const checkmobNeighborhoods = useMemo(() => {
        const unique = new Set(
            restaurants
                .map(r => r.address?.neighborhood || '')
                .filter(n => n && n !== 'undefined' && n.trim() !== '')
        );
        return ['all', ...Array.from(unique).sort()];
    }, [restaurants]);
    
    const checkmobCities = useMemo(() => {
        const unique = new Set(
            restaurants
                .map(r => r.address?.city || '')
                .filter(c => c && c !== 'undefined' && c.trim() !== '')
        );
        return ['all', ...Array.from(unique).sort()];
    }, [restaurants]);
    
    const checkmobStates = useMemo(() => {
        const unique = new Set<string>();
        restaurants.forEach(r => {
            // Parsear address se for string JSON
            let addressObj = r.address;
            if (typeof r.address === 'string') {
                try {
                    addressObj = JSON.parse(r.address);
                } catch (e) {
                    addressObj = r.address;
                }
            }
            const state = (addressObj?.state || addressObj?.estado || '').trim();
            if (state && state !== 'undefined' && state !== '') {
                unique.add(state);
            }
        });
        return ['all', ...Array.from(unique).sort()];
    }, [restaurants]);
    
    // Filtrar restaurantes para exportação Checkmob
    const checkmobFilteredRestaurants = useMemo(() => {
        return restaurants.filter(r => {
            // Filtro por executivo
            if (checkmobFilterSeller !== 'all') {
                if (checkmobFilterSeller === 'sem-executivo') {
                    if (r.sellerId) return false;
                } else {
                    if (r.sellerId !== checkmobFilterSeller) return false;
                }
            }
            
            // Filtro por status
            if (checkmobFilterStatus !== 'all' && r.status !== checkmobFilterStatus) return false;
            
            // Filtro por potencial (múltipla seleção)
            if (checkmobFilterPotential.length > 0 && !checkmobFilterPotential.includes(r.salesPotential || '')) return false;
            
            // Filtro por bairro
            if (checkmobFilterNeighborhood !== 'all') {
                const neighborhood = r.address?.neighborhood || '';
                if (neighborhood !== checkmobFilterNeighborhood) return false;
            }
            
            // Filtro por cidade
            if (checkmobFilterCity !== 'all') {
                const city = r.address?.city || '';
                if (city !== checkmobFilterCity) return false;
            }
            
            // Filtro por estado (normalizar para comparação)
            if (checkmobFilterState !== 'all') {
                // Parsear address se for string JSON
                let addressObj = r.address;
                if (typeof r.address === 'string') {
                    try {
                        addressObj = JSON.parse(r.address);
                    } catch (e) {
                        addressObj = r.address;
                    }
                }
                
                const state = (addressObj?.state || addressObj?.estado || '').trim().toUpperCase();
                const filterState = checkmobFilterState.trim().toUpperCase();
                
                if (state !== filterState) {
                    return false;
                }
            }
            
            // Filtro por leads quentes (ALTÍSSIMO + Qualificado/Contatado)
            if (checkmobFilterHotLeads) {
                const isHighPotential = r.salesPotential === 'ALTÍSSIMO' || r.salesPotential === 'ALTISSIMO';
                const isQualifiedOrContacted = r.status === 'Qualificado' || r.status === 'Contatado';
                if (!(isHighPotential && isQualifiedOrContacted)) return false;
            }
            
            return true;
        });
    }, [
        restaurants,
        checkmobFilterSeller,
        checkmobFilterStatus,
        checkmobFilterPotential,
        checkmobFilterNeighborhood,
        checkmobFilterCity,
        checkmobFilterState,
        checkmobFilterHotLeads
    ]);

    // Follow-ups do vendedor
    const sellerFollowUps = followUps.filter(f => 
        carteiraRestaurants.some(r => r.id === f.restaurantId)
    );

    // Visitas do vendedor
    const sellerVisits = visits.filter(v => v.sellerId === selectedSellerId);

    // Estatísticas da carteira
    const stats = useMemo(() => {
        const total = carteiraRestaurants.length;
        const aAnalisar = carteiraRestaurants.filter(r => r.status === 'A Analisar').length;
        const qualificados = carteiraRestaurants.filter(r => r.status === 'Qualificado').length;
        const contatados = carteiraRestaurants.filter(r => r.status === 'Contatado').length;
        const negociacao = carteiraRestaurants.filter(r => r.status === 'Negociação').length;
        const fechados = carteiraRestaurants.filter(r => r.status === 'Fechado').length;
        const altissimo = carteiraRestaurants.filter(r => r.salesPotential === 'ALTISSIMO').length;
        const alto = carteiraRestaurants.filter(r => r.salesPotential === 'ALTO').length;
        
        return { total, aAnalisar, qualificados, contatados, negociacao, fechados, altissimo, alto };
    }, [carteiraRestaurants]);

    // Restaurante selecionado para Quick View
    const quickViewRestaurant = quickViewId ? filteredRestaurants.find(r => r.id === quickViewId) || carteiraRestaurants.find(r => r.id === quickViewId) : null;
    const quickViewFollowUps = quickViewId ? sellerFollowUps.filter(f => f.restaurantId === quickViewId) : [];
    const quickViewVisits = quickViewId ? sellerVisits.filter(v => v.restaurantId === quickViewId) : [];

    // Agendar visita
    const handleScheduleVisit = async () => {
        if (!showScheduleModal || !scheduleData.date) return;

        setLoading(true);
        try {
            await scheduleVisit(showScheduleModal, selectedSellerId, scheduleData.date, scheduleData.notes);
            setShowScheduleModal(null);
            setScheduleData({ date: '', time: '', notes: '' });
            alert('✅ Visita agendada com sucesso!');
        } catch (error) {
            alert('❌ Erro ao agendar visita');
        }
        setLoading(false);
    };

    // Atualizar status do cliente
    const handleUpdateStatus = async (restaurantId: string, newStatus: string) => {
        setLoading(true);
        try {
            await updateClientStatus(restaurantId, newStatus);
            setEditingStatus(null);
            // Salvar posição do scroll antes de atualizar
            scrollPositionRef.current = window.scrollY || window.pageYOffset;
            // Atualizar dados sem recarregar página completa
            router.refresh();
            // Restaurar posição do scroll após um pequeno delay
            setTimeout(() => {
                window.scrollTo(0, scrollPositionRef.current);
            }, 100);
        } catch (error) {
            alert('❌ Erro ao atualizar status');
        }
        setLoading(false);
    };

    // Atualizar prioridade
    const handleUpdatePriority = async (restaurantId: string, newPriority: string) => {
        setLoading(true);
        try {
            await updateClientPriority(restaurantId, newPriority);
            setEditingPriority(null);
            // Salvar posição do scroll antes de atualizar
            scrollPositionRef.current = window.scrollY || window.pageYOffset;
            // Atualizar dados sem recarregar página completa
            router.refresh();
            // Restaurar posição do scroll após um pequeno delay
            setTimeout(() => {
                window.scrollTo(0, scrollPositionRef.current);
            }, 100);
        } catch (error) {
            alert('❌ Erro ao atualizar prioridade');
        }
        setLoading(false);
    };

    // Adicionar nota rápida
    // Preenchimento automático inteligente da semana
    const handleIntelligentAutoFill = async () => {
        if (!selectedSellerId) {
            alert('Selecione um executivo primeiro.');
            return;
        }

        setLoading(true);
        try {
            console.log('🔍 Iniciando análise de preenchimento inteligente...');
            
            // Primeiro, analisar e obter sugestões
            // Buscar agendamentos existentes para passar para a análise
            const existingSchedule = await getWeeklySchedule(selectedSellerId, currentWeekStart.toISOString());
            
            const analyzedSuggestions = await analyzeIntelligentFill(
                carteiraRestaurants.map(r => ({
                    id: r.id,
                    name: r.name,
                    address: r.address,
                    salesPotential: r.salesPotential,
                    rating: r.rating,
                    status: r.status,
                    projectedDeliveries: r.projectedDeliveries || 0,
                    reviewCount: r.reviewCount || 0
                })),
                selectedSellerId,
                currentWeekStart,
                existingSchedule // Passar agendamentos existentes
            );

            console.log(`📋 Encontradas ${analyzedSuggestions.length} sugestões que precisam de confirmação`);

            // Se não há sugestões, executar preenchimento direto
            if (analyzedSuggestions.length === 0) {
                console.log('✅ Nenhuma confirmação necessária, executando preenchimento direto...');
                await executeFillWithDecisions([]);
                return;
            }

            // Se há sugestões, mostrar modais sequenciais
            setSuggestions(analyzedSuggestions);
            setCurrentSuggestionIndex(0);
            setUserDecisions([]);
            setLoading(false); // Parar loading para mostrar modal
        } catch (error: any) {
            console.error('Erro ao analisar preenchimento:', error);
            alert(`❌ Erro ao analisar preenchimento inteligente.\n\n${error.message || 'Erro desconhecido'}`);
            setLoading(false);
        }
    };

    // Executar preenchimento com decisões do usuário
    const executeFillWithDecisions = async (decisions: UserDecision[]) => {
        try {
            console.log('🚀 Executando preenchimento com decisões do usuário...');
            
            const result = await autoFillWeeklySchedule(
                selectedSellerId,
                carteiraRestaurants.map(r => ({
                    id: r.id,
                    name: r.name,
                    address: r.address,
                    salesPotential: r.salesPotential,
                    rating: r.rating,
                    status: r.status,
                    projectedDeliveries: r.projectedDeliveries || 0,
                    reviewCount: r.reviewCount || 0
                })),
                currentWeekStart.toISOString(),
                decisions
            );

            console.log('Resultado:', result);

            if (result.success) {
                const total = result.total || result.schedule?.length || 0;
                alert(`✅ Agenda preenchida automaticamente!\n\n${total} visitas agendadas e salvas no banco de dados.`);
                // Salvar posição do scroll antes de atualizar
                scrollPositionRef.current = window.scrollY || window.pageYOffset;
                // Atualizar dados sem recarregar página completa
                router.refresh();
                // Restaurar posição do scroll após um pequeno delay
                setTimeout(() => {
                    window.scrollTo(0, scrollPositionRef.current);
                }, 100);
            } else {
                alert(`❌ Erro ao preencher agenda automaticamente.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('Erro:', error);
            alert(`❌ Erro ao preencher agenda automaticamente.\n\n${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    // Handler para confirmação do modal
    const handleModalConfirm = (selectedRestaurantIds: string[]) => {
        const currentSuggestion = suggestions[currentSuggestionIndex];
        if (!currentSuggestion) return;

        console.log(`✅ Usuário confirmou sugestão ${currentSuggestion.id} com ${selectedRestaurantIds.length} restaurante(s)`);
        console.log(`   Restaurantes selecionados:`, selectedRestaurantIds);

        const decision: UserDecision = {
            suggestionId: currentSuggestion.id,
            accepted: true,
            selectedRestaurantIds: selectedRestaurantIds.length > 0 ? selectedRestaurantIds : undefined
        };

        const newDecisions = [...userDecisions, decision];
        setUserDecisions(newDecisions);

        // Avançar para próximo modal ou executar preenchimento
        if (currentSuggestionIndex < suggestions.length - 1) {
            setCurrentSuggestionIndex(currentSuggestionIndex + 1);
        } else {
            // Todas as confirmações feitas, executar preenchimento
            console.log(`🚀 Todas as confirmações concluídas. Total de decisões: ${newDecisions.length}`);
            setCurrentSuggestionIndex(-1); // Fechar modal
            executeFillWithDecisions(newDecisions);
        }
    };

    // Handler para cancelar modal
    const handleModalCancel = () => {
        const currentSuggestion = suggestions[currentSuggestionIndex];
        if (!currentSuggestion) return;

        console.log(`❌ Usuário cancelou sugestão ${currentSuggestion.id}`);

        const decision: UserDecision = {
            suggestionId: currentSuggestion.id,
            accepted: false
        };

        const newDecisions = [...userDecisions, decision];
        setUserDecisions(newDecisions);

        // Avançar para próximo modal ou executar preenchimento
        if (currentSuggestionIndex < suggestions.length - 1) {
            setCurrentSuggestionIndex(currentSuggestionIndex + 1);
        } else {
            // Todas as confirmações feitas, executar preenchimento
            console.log(`🚀 Todas as confirmações concluídas (com cancelamentos). Total de decisões: ${newDecisions.length}`);
            setCurrentSuggestionIndex(-1); // Fechar modal
            executeFillWithDecisions(newDecisions);
        }
    };

    // Handler para pular (skip) no modal
    const handleModalSkip = () => {
        const currentSuggestion = suggestions[currentSuggestionIndex];
        if (!currentSuggestion) return;

        const decision: UserDecision = {
            suggestionId: currentSuggestion.id,
            accepted: false // Skip = não aceitar
        };

        const newDecisions = [...userDecisions, decision];
        setUserDecisions(newDecisions);

        // Avançar para próximo modal ou executar preenchimento
        if (currentSuggestionIndex < suggestions.length - 1) {
            setCurrentSuggestionIndex(currentSuggestionIndex + 1);
        } else {
            // Todas as confirmações feitas, executar preenchimento
            setCurrentSuggestionIndex(-1); // Fechar modal
            executeFillWithDecisions(newDecisions);
        }
    };

    // Funções para exportação Checkmob
    const handleCheckmobSelectRestaurant = (restaurantId: string) => {
        setCheckmobSelectedRestaurants(prev => {
            const newSet = new Set(prev);
            if (newSet.has(restaurantId)) {
                newSet.delete(restaurantId);
            } else {
                newSet.add(restaurantId);
            }
            return newSet;
        });
    };

    const handleCheckmobSelectAll = () => {
        if (checkmobSelectedRestaurants.size === checkmobFilteredRestaurants.length) {
            setCheckmobSelectedRestaurants(new Set());
        } else {
            setCheckmobSelectedRestaurants(new Set(checkmobFilteredRestaurants.map(r => r.id)));
        }
    };

    const handleExportToCheckmob = async () => {
        const idsToExport = checkmobSelectedRestaurants.size > 0 
            ? Array.from(checkmobSelectedRestaurants) 
            : checkmobFilteredRestaurants.map(r => r.id);

        if (idsToExport.length === 0) {
            alert('⚠️ Nenhum cliente selecionado para exportar.');
            return;
        }

        if (!confirm(`Deseja exportar ${idsToExport.length} cliente(s) para o formato Checkmob?\n\nO arquivo será baixado no formato do template de cadastro.`)) {
            return;
        }

        setCheckmobExporting(true);
        try {
            const result = await exportRestaurantsToCheckmob(idsToExport);
            
            if (result.success && result.data) {
                // Converter base64 para Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });

                // Criar link temporário para download
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = result.filename || `Checkmob_Cadastro_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                alert(`✅ Planilha Checkmob exportada com sucesso!\n\n${result.count} cliente(s) exportado(s).`);
                setCheckmobSelectedRestaurants(new Set());
            } else {
                alert(`❌ Erro ao exportar planilha.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('Erro ao exportar:', error);
            alert(`❌ Erro ao exportar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setCheckmobExporting(false);
        }
    };

    // Exportar agenda semanal para Excel
    const handleExportExcel = async () => {
        if (!selectedSellerId) {
            alert('Selecione um executivo primeiro.');
            return;
        }

        setLoading(true);
        try {
            const result = await exportWeeklyScheduleToExcel(
                selectedSellerId,
                currentWeekStart.toISOString()
            );

            if (result.success && result.data) {
                // Converter base64 para Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });

                // Criar link temporário para download
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = result.filename || `Agenda_Semanal_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                alert('✅ Planilha Excel exportada com sucesso!\n\nA planilha contém:\n• Dashboard Executivo\n• Calendário Semanal\n• Lista Detalhada de Visitas\n• Análise de Performance\n• Mapa de Calor\n• Top Restaurantes\n• Resumo Executivo');
            } else {
                alert(`❌ Erro ao exportar planilha.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('Erro ao exportar:', error);
            alert(`❌ Erro ao exportar planilha.\n\n${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    // Exportar agenda semanal para template de agendamento
    const [agendamentoExporting, setAgendamentoExporting] = useState(false);
    const handleExportAgendamento = async () => {
        console.log('🚀 Iniciando exportação de agendamento...');
        console.log('   selectedSellerId:', selectedSellerId);
        console.log('   currentWeekStart:', currentWeekStart);
        
        if (!selectedSellerId) {
            alert('Selecione um executivo primeiro.');
            return;
        }

        setAgendamentoExporting(true);
        try {
            console.log('📞 Chamando exportWeeklyScheduleToAgendamentoTemplate...');
            const result = await exportWeeklyScheduleToAgendamentoTemplate(
                selectedSellerId,
                currentWeekStart.toISOString()
            );

            console.log('📥 Resultado recebido:', result);

            if (result.success && result.data) {
                console.log('✅ Exportação bem-sucedida! Convertendo base64 para Blob...');
                // Converter base64 para Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });

                console.log('📦 Blob criado, tamanho:', blob.size, 'bytes');

                // Criar link temporário para download
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = result.filename || `Agendamento_Semanal_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                console.log('🔗 Link criado, iniciando download...');
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                alert(`✅ Planilha de Agendamento exportada com sucesso!\n\n${result.count || 0} agendamento(s) exportado(s).`);
            } else {
                console.error('❌ Erro na exportação:', result.error);
                alert(`❌ Erro ao exportar planilha.\n\n${result.error || 'Erro desconhecido'}`);
            }
        } catch (error: any) {
            console.error('❌ Erro ao exportar:', error);
            console.error('   Stack:', error.stack);
            alert(`❌ Erro ao exportar planilha.\n\n${error.message || 'Erro desconhecido'}\n\nVerifique o console para mais detalhes.`);
        } finally {
            setAgendamentoExporting(false);
            console.log('🏁 Exportação finalizada');
        }
    };

    const handleAddNote = async () => {
        if (!quickViewId || !newNote.trim()) return;
        
        setLoading(true);
        try {
            await addNote(quickViewId, newNote);
            setNewNote('');
            alert('✅ Nota adicionada!');
        } catch (error) {
            alert('❌ Erro ao adicionar nota');
        }
        setLoading(false);
    };

    // Adicionar/remover do plano da semana
    const toggleWeekPlan = (restaurantId: string) => {
        if (weekPlan.includes(restaurantId)) {
            setWeekPlan(prev => prev.filter(id => id !== restaurantId));
        } else {
            setWeekPlan(prev => [...prev, restaurantId]);
        }
    };

    // Obter prioridade visual
    const getPriorityBadge = (potential: string | null) => {
        switch (potential) {
            case 'ALTISSIMO': return { label: '🔥 Altíssimo', class: styles.priorityAltissimo };
            case 'ALTO': return { label: '⬆️ Alto', class: styles.priorityAlto };
            case 'MEDIO': return { label: '➡️ Médio', class: styles.priorityMedio };
            case 'BAIXO': return { label: '⬇️ Baixo', class: styles.priorityBaixo };
            default: return { label: '❓ N/D', class: styles.priorityNd };
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, string> = {
            'A Analisar': styles.statusAnalisar,
            'Qualificado': styles.statusQualificado,
            'Contatado': styles.statusContatado,
            'Negociação': styles.statusNegociacao,
            'Fechado': styles.statusFechado
        };
        return statusMap[status] || styles.statusAnalisar;
    };

    // Formatar data
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    // Próximos dias da semana
    const weekDays = useMemo(() => {
        const days = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push({
                date: date.toISOString().split('T')[0],
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                dayNum: date.getDate(),
                month: date.toLocaleDateString('pt-BR', { month: 'short' }),
                isToday: i === 0
            });
        }
        return days;
    }, []);

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>💼 Carteira de Clientes</h1>
                    <p>{activeTab === 'carteira-padrao' ? 'Visão geral de todas as carteiras de executivos' : 'Gestão de prospecção por executivo'}</p>
                </div>
                {activeTab !== 'carteira-padrao' && (
                    <div className={styles.headerRight}>
                        <div className={styles.sellerSelect}>
                            <label>Executivo:</label>
                            <select 
                                value={selectedSellerId} 
                                onChange={e => setSelectedSellerId(e.target.value)}
                            >
                                {sellers.map(seller => (
                                    <option key={seller.id} value={seller.id}>
                                        {seller.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </header>

            {/* Seller Card - Apenas na aba individual */}
            {activeTab !== 'carteira-padrao' && selectedSeller && (
                <div className={styles.sellerCard}>
                    <div className={styles.sellerInfo}>
                        <div className={styles.sellerAvatar}>
                            {selectedSeller.photoUrl ? (
                                <img src={selectedSeller.photoUrl} alt={selectedSeller.name} />
                            ) : (
                                <span>{selectedSeller.name.charAt(0)}</span>
                            )}
                        </div>
                        <div className={styles.sellerDetails}>
                            <h2>{selectedSeller.name}</h2>
                            <p>{selectedSeller.email}</p>
                            <div className={styles.sellerRegions}>
                                {selectedSeller.zonas && selectedSeller.zonas.length > 0 ? (
                                    selectedSeller.zonas.map((area, i) => (
                                        <span key={i} className={styles.regionTag}>📍 {area}</span>
                                    ))
                                ) : (
                                    <span className={styles.noZonaTag}>Sem áreas de cobertura configuradas</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={styles.sellerStats}>
                        <div className={styles.sellerStat}>
                            <span className={styles.statIcon}>👥</span>
                            <span className={styles.statValue}>{stats.total}</span>
                            <span className={styles.statLabel}>Clientes</span>
                        </div>
                        <div className={styles.sellerStat}>
                            <span className={styles.statIcon}>🔥</span>
                            <span className={styles.statValue}>{stats.altissimo + stats.alto}</span>
                            <span className={styles.statLabel}>Hot Leads</span>
                        </div>
                        <div className={styles.sellerStat}>
                            <span className={styles.statIcon}>📅</span>
                            <span className={styles.statValue}>{sellerFollowUps.length}</span>
                            <span className={styles.statLabel}>Follow-ups</span>
                        </div>
                        <div className={styles.sellerStat}>
                            <span className={styles.statIcon}>📋</span>
                            <span className={styles.statValue}>{weekPlan.length}</span>
                            <span className={styles.statLabel}>Plano Semana</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className={styles.tabs}>
                <button 
                    className={`${styles.tab} ${activeTab === 'carteira-padrao' ? styles.active : ''}`}
                    onClick={() => setActiveTab('carteira-padrao')}
                >
                    💼 Carteira Padrão
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'carteira' ? styles.active : ''}`}
                    onClick={() => setActiveTab('carteira')}
                >
                    📋 Carteira Individual
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'semana' ? styles.active : ''}`}
                    onClick={() => setActiveTab('semana')}
                >
                    📅 Plano da Semana {weekPlan.length > 0 && <span className={styles.badge}>{weekPlan.length}</span>}
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'agenda' ? styles.active : ''}`}
                    onClick={() => setActiveTab('agenda')}
                >
                    🗓️ Agenda Completa
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'mapa' ? styles.active : ''}`}
                    onClick={() => setActiveTab('mapa')}
                >
                    🗺️ Mapa da Região
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'exportar-checkmob' ? styles.active : ''}`}
                    onClick={() => setActiveTab('exportar-checkmob')}
                >
                    📥 Exportar Checkmob
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'clientes-fixos' ? styles.active : ''}`}
                    onClick={() => setActiveTab('clientes-fixos')}
                >
                    📌 Clientes Fixos
                </button>
            </div>

            {/* Tab Content - Carteira Padrão */}
            {activeTab === 'carteira-padrao' && (
                <div className={styles.carteiraPadraoContainer}>
                    {/* Search e Filtros Globais */}
                    <div className={styles.filters}>
                        <div className={styles.searchBox}>
                            <span>🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar restaurante, executivo ou bairro..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Todos os Status</option>
                            <option value="A Analisar">A Analisar</option>
                            <option value="Qualificado">Qualificado</option>
                            <option value="Contatado">Contatado</option>
                            <option value="Negociação">Negociação</option>
                            <option value="Fechado">Fechado</option>
                        </select>
                        <div className={`${styles.dropdownContainer} ${styles.potentialFilterDropdown}`}>
                            <button
                                type="button"
                                className={styles.dropdownButton}
                                onClick={() => setPotentialDropdownOpen(!potentialDropdownOpen)}
                            >
                                <span>
                                    {filterPotential.length === 0 
                                        ? 'Nenhum selecionado' 
                                        : filterPotential.length === 4
                                        ? 'Todos os Potenciais'
                                        : filterPotential.length === 1
                                        ? (filterPotential[0] === 'ALTISSIMO' ? '🔥 Altíssimo' :
                                           filterPotential[0] === 'ALTO' ? '⬆️ Alto' :
                                           filterPotential[0] === 'MEDIO' ? '➡️ Médio' :
                                           filterPotential[0] === 'BAIXO' ? '⬇️ Baixo' : filterPotential[0])
                                        : `${filterPotential.length} selecionados`}
                                </span>
                                <span className={styles.dropdownArrow}>
                                    {potentialDropdownOpen ? '▲' : '▼'}
                                </span>
                            </button>
                            {potentialDropdownOpen && (
                                <div className={styles.dropdownMenu}>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.length === 4}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential(['ALTISSIMO', 'ALTO', 'MEDIO', 'BAIXO']);
                                                } else {
                                                    setFilterPotential([]);
                                                }
                                            }}
                                        />
                                        <span>Todos</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('ALTISSIMO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'ALTISSIMO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'ALTISSIMO'));
                                                }
                                            }}
                                        />
                                        <span>🔥 Altíssimo</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('ALTO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'ALTO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'ALTO'));
                                                }
                                            }}
                                        />
                                        <span>⬆️ Alto</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('MEDIO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'MEDIO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'MEDIO'));
                                                }
                                            }}
                                        />
                                        <span>➡️ Médio</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('BAIXO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'BAIXO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'BAIXO'));
                                                }
                                            }}
                                        />
                                        <span>⬇️ Baixo</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Carteiras de Todos os Executivos */}
                    {sellers.map(seller => {
                        // Filtrar restaurantes deste executivo
                        const sellerRestaurants = restaurants.filter(r => r.sellerId === seller.id);
                        
                        // Aplicar filtros globais
                        const filteredSellerRestaurants = sellerRestaurants.filter(r => {
                            if (searchTerm) {
                                const search = searchTerm.toLowerCase();
                                if (!r.name.toLowerCase().includes(search) &&
                                    !seller.name.toLowerCase().includes(search) &&
                                    !r.address?.neighborhood?.toLowerCase().includes(search) &&
                                    !r.address?.city?.toLowerCase().includes(search)) {
                                    return false;
                                }
                            }
                            if (filterStatus !== 'all' && r.status !== filterStatus) return false;
                            // Se nenhum estiver selecionado OU se o array estiver vazio, mostrar todos
                            if (filterPotential.length > 0 && filterPotential.length < 4 && !filterPotential.includes(r.salesPotential || '')) return false;
                            return true;
                        });

                        // Visitas deste executivo
                        const sellerVisits = visits.filter(v => v.sellerId === seller.id);
                        
                        // Estatísticas deste executivo
                        const sellerStats = {
                            total: sellerRestaurants.length,
                            visitados: sellerRestaurants.filter(r => 
                                sellerVisits.some(v => v.restaurantId === r.id)
                            ).length,
                            naoVisitados: sellerRestaurants.filter(r => 
                                !sellerVisits.some(v => v.restaurantId === r.id)
                            ).length,
                            aAnalisar: sellerRestaurants.filter(r => r.status === 'A Analisar').length,
                            qualificados: sellerRestaurants.filter(r => r.status === 'Qualificado').length,
                            contatados: sellerRestaurants.filter(r => r.status === 'Contatado').length,
                            negociacao: sellerRestaurants.filter(r => r.status === 'Negociação').length,
                            fechados: sellerRestaurants.filter(r => r.status === 'Fechado').length,
                        };

                        if (filteredSellerRestaurants.length === 0 && sellerRestaurants.length === 0) return null;

                        return (
                            <div key={seller.id} className={styles.executivoCarteiraSection}>
                                {/* Header do Executivo */}
                                <div className={styles.executivoCarteiraHeader}>
                                    <div className={styles.executivoInfo}>
                                        <div className={styles.executivoAvatar}>
                                            {seller.photoUrl ? (
                                                <img src={seller.photoUrl} alt={seller.name} />
                                            ) : (
                                                <span>{seller.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3>{seller.name}</h3>
                                            <p>{seller.email || 'Sem email'}</p>
                                        </div>
                                    </div>
                                    <div className={styles.executivoStats}>
                                        <div className={styles.miniStat}>
                                            <span className={styles.miniStatValue}>{sellerStats.total}</span>
                                            <span className={styles.miniStatLabel}>Total</span>
                                        </div>
                                        <div className={styles.miniStat}>
                                            <span className={styles.miniStatValue} style={{ color: '#22c55e' }}>
                                                {sellerStats.visitados}
                                            </span>
                                            <span className={styles.miniStatLabel}>Visitados</span>
                                        </div>
                                        <div className={styles.miniStat}>
                                            <span className={styles.miniStatValue} style={{ color: '#f59e0b' }}>
                                                {sellerStats.naoVisitados}
                                            </span>
                                            <span className={styles.miniStatLabel}>Não Visitados</span>
                                        </div>
                                        <div className={styles.miniStat}>
                                            <span className={styles.miniStatValue} style={{ color: '#22c55e' }}>
                                                {sellerStats.fechados}
                                            </span>
                                            <span className={styles.miniStatLabel}>Fechados</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabela de Restaurantes */}
                                {filteredSellerRestaurants.length > 0 ? (
                                    <div className={styles.tableWrapper}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th>Restaurante</th>
                                                    <th>Bairro</th>
                                                    <th>Status</th>
                                                    <th>Potencial</th>
                                                    <th>Visitação</th>
                                                    <th>Avaliação</th>
                                                    <th>Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSellerRestaurants.map(restaurant => {
                                                    const hasVisit = sellerVisits.some(v => v.restaurantId === restaurant.id);
                                                    const lastVisit = sellerVisits
                                                        .filter(v => v.restaurantId === restaurant.id)
                                                        .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
                                                    const priority = getPriorityBadge(restaurant.salesPotential);
                                                    
                                                    return (
                                                        <tr key={restaurant.id}>
                                                            <td>
                                                                <div className={styles.clientCell}>
                                                                    <strong>{restaurant.name}</strong>
                                                                </div>
                                                            </td>
                                                            <td>{restaurant.address?.neighborhood || 'N/D'}</td>
                                                            <td>
                                                                <span className={`${styles.statusBadge} ${getStatusBadge(restaurant.status)}`}>
                                                                    {restaurant.status}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                                    {priority.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {hasVisit ? (
                                                                    <div className={styles.visitStatus}>
                                                                        <span style={{ color: '#22c55e' }}>✅ Visitado</span>
                                                                        {lastVisit && (
                                                                            <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                                                                {formatDate(lastVisit.visitDate)}
                                                                            </small>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#f59e0b' }}>⏳ Não Visitado</span>
                                                                )}
                                                            </td>
                                                            <td>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</td>
                                                            <td>
                                                                <div className={styles.tableActions}>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setQuickViewId(restaurant.id);
                                                                            setQuickViewTab('info');
                                                                        }}
                                                                        title="Ver detalhes"
                                                                    >
                                                                        👁️
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setSelectedSellerId(seller.id);
                                                                            setShowScheduleModal(restaurant.id);
                                                                        }}
                                                                        title="Agendar visita"
                                                                    >
                                                                        📅
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>
                                        <span>📭</span>
                                        <p>Nenhum restaurante encontrado com os filtros aplicados</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {sellers.length === 0 && (
                        <div className={styles.emptyState}>
                            <span>👥</span>
                            <h3>Nenhum executivo cadastrado</h3>
                            <p>Cadastre executivos para ver suas carteiras</p>
                        </div>
                    )}
                </div>
            )}

            {/* Tab Content - Carteira Individual */}
            {activeTab === 'carteira' && (
                <>
                    {/* Filters */}
                    <div className={styles.filters}>
                        <div className={styles.searchBox}>
                            <span>🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar cliente, categoria ou bairro..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Todos os Status</option>
                            <option value="A Analisar">A Analisar</option>
                            <option value="Qualificado">Qualificado</option>
                            <option value="Contatado">Contatado</option>
                            <option value="Negociação">Negociação</option>
                            <option value="Fechado">Fechado</option>
                        </select>
                        <div className={`${styles.dropdownContainer} ${styles.potentialFilterDropdown}`}>
                            <button
                                type="button"
                                className={styles.dropdownButton}
                                onClick={() => setPotentialDropdownOpen(!potentialDropdownOpen)}
                            >
                                <span>
                                    {filterPotential.length === 0 
                                        ? 'Nenhum selecionado' 
                                        : filterPotential.length === 4
                                        ? 'Todos os Potenciais'
                                        : filterPotential.length === 1
                                        ? (filterPotential[0] === 'ALTISSIMO' ? '🔥 Altíssimo' :
                                           filterPotential[0] === 'ALTO' ? '⬆️ Alto' :
                                           filterPotential[0] === 'MEDIO' ? '➡️ Médio' :
                                           filterPotential[0] === 'BAIXO' ? '⬇️ Baixo' : filterPotential[0])
                                        : `${filterPotential.length} selecionados`}
                                </span>
                                <span className={styles.dropdownArrow}>
                                    {potentialDropdownOpen ? '▲' : '▼'}
                                </span>
                            </button>
                            {potentialDropdownOpen && (
                                <div className={styles.dropdownMenu}>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.length === 4}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential(['ALTISSIMO', 'ALTO', 'MEDIO', 'BAIXO']);
                                                } else {
                                                    setFilterPotential([]);
                                                }
                                            }}
                                        />
                                        <span>Todos</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('ALTISSIMO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'ALTISSIMO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'ALTISSIMO'));
                                                }
                                            }}
                                        />
                                        <span>🔥 Altíssimo</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('ALTO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'ALTO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'ALTO'));
                                                }
                                            }}
                                        />
                                        <span>⬆️ Alto</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('MEDIO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'MEDIO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'MEDIO'));
                                                }
                                            }}
                                        />
                                        <span>➡️ Médio</span>
                                    </label>
                                    <label className={styles.dropdownOption}>
                                        <input 
                                            type="checkbox"
                                            checked={filterPotential.includes('BAIXO')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterPotential([...filterPotential, 'BAIXO']);
                                                } else {
                                                    setFilterPotential(filterPotential.filter(p => p !== 'BAIXO'));
                                                }
                                            }}
                                        />
                                        <span>⬇️ Baixo</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className={styles.viewModes}>
                            <button 
                                className={viewMode === 'cards' ? styles.active : ''}
                                onClick={() => setViewMode('cards')}
                                title="Cards"
                            >
                                ▦
                            </button>
                            <button 
                                className={viewMode === 'list' ? styles.active : ''}
                                onClick={() => setViewMode('list')}
                                title="Lista"
                            >
                                ☰
                            </button>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className={styles.statsBar}>
                        <div className={styles.statItem}>
                            <span className={styles.statDot} style={{ background: '#94a3b8' }}></span>
                            <span>A Analisar: {stats.aAnalisar}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statDot} style={{ background: '#38bdf8' }}></span>
                            <span>Qualificado: {stats.qualificados}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statDot} style={{ background: '#fbbf24' }}></span>
                            <span>Contatado: {stats.contatados}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statDot} style={{ background: '#a855f7' }}></span>
                            <span>Negociação: {stats.negociacao}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statDot} style={{ background: '#22c55e' }}></span>
                            <span>Fechado: {stats.fechados}</span>
                        </div>
                    </div>

                    {/* Cards View */}
                    {viewMode === 'cards' && (
                        <div className={styles.cardsGrid}>
                            {filteredRestaurants.map(restaurant => {
                                const priority = getPriorityBadge(restaurant.salesPotential);
                                const isInWeekPlan = weekPlan.includes(restaurant.id);
                                const hasFollowUp = sellerFollowUps.some(f => f.restaurantId === restaurant.id);
                                
                                return (
                                    <div 
                                        key={restaurant.id} 
                                        className={`${styles.card} ${isInWeekPlan ? styles.inWeekPlan : ''}`}
                                    >
                                        <div className={styles.cardHeader}>
                                            <div className={styles.cardTitle}>
                                                <h3>{restaurant.name}</h3>
                                                <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                    {priority.label}
                                                </span>
                                            </div>
                                            <button 
                                                className={`${styles.weekPlanBtn} ${isInWeekPlan ? styles.active : ''}`}
                                                onClick={() => toggleWeekPlan(restaurant.id)}
                                                title={isInWeekPlan ? 'Remover do plano' : 'Adicionar ao plano'}
                                            >
                                                {isInWeekPlan ? '✓' : '+'}
                                            </button>
                                        </div>
                                        
                                        <div className={styles.cardBody}>
                                            <div className={styles.cardInfo}>
                                                <span>📍 {restaurant.address?.neighborhood || 'N/D'}</span>
                                                <span>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</span>
                                                <span>📝 {restaurant.commentsCount} comentários</span>
                                            </div>
                                            
                                        <div className={styles.cardMeta}>
                                            <span className={`${styles.statusBadge} ${getStatusBadge(restaurant.status)}`}>
                                                {restaurant.status}
                                            </span>
                                            {hasFollowUp && (
                                                <span className={styles.followUpBadge}>📅 Follow-up</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className={styles.cardActions}>
                                        <button 
                                            className={styles.viewBtn}
                                            onClick={() => {
                                                setQuickViewId(restaurant.id);
                                                setQuickViewTab('info');
                                            }}
                                        >
                                            👁️ Ver
                                        </button>
                                        <button 
                                            className={styles.scheduleBtn}
                                            onClick={() => setShowScheduleModal(restaurant.id)}
                                        >
                                            📅 Agendar
                                        </button>
                                    </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* List View */}
                    {viewMode === 'list' && (
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Semana</th>
                                        <th>Cliente</th>
                                        <th>Bairro</th>
                                        <th>Potencial</th>
                                        <th>Status</th>
                                        <th>Avaliação</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRestaurants.map(restaurant => {
                                        const priority = getPriorityBadge(restaurant.salesPotential);
                                        const isInWeekPlan = weekPlan.includes(restaurant.id);
                                        
                                        return (
                                            <tr key={restaurant.id} className={isInWeekPlan ? styles.inWeekPlan : ''}>
                                                <td>
                                                    <button 
                                                        className={`${styles.weekPlanCheck} ${isInWeekPlan ? styles.active : ''}`}
                                                        onClick={() => toggleWeekPlan(restaurant.id)}
                                                    >
                                                        {isInWeekPlan ? '✓' : ''}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div className={styles.clientCell}>
                                                        <strong>{restaurant.name}</strong>
                                                        {restaurant.category && <span>{restaurant.category}</span>}
                                                    </div>
                                                </td>
                                                <td>{restaurant.address?.neighborhood || 'N/D'}</td>
                                                <td>
                                                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                        {priority.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${getStatusBadge(restaurant.status)}`}>
                                                        {restaurant.status}
                                                    </span>
                                                </td>
                                                <td>⭐ {restaurant.rating?.toFixed(1) || 'N/D'}</td>
                                                <td>
                                                    <div className={styles.tableActions}>
                                                        <button onClick={() => {
                                                            setQuickViewId(restaurant.id);
                                                            setQuickViewTab('info');
                                                        }}>👁️</button>
                                                        <button onClick={() => setShowScheduleModal(restaurant.id)}>📅</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {filteredRestaurants.length === 0 && (
                        <div className={styles.emptyState}>
                            <span>📭</span>
                            <h3>Nenhum cliente encontrado</h3>
                            <p>Ajuste os filtros ou adicione novos clientes à carteira</p>
                        </div>
                    )}
                </>
            )}

            {/* Week Plan Tab */}
            {activeTab === 'semana' && (
                <div className={styles.weekPlanSection}>
                    <div className={styles.weekHeader}>
                        <div>
                            <h2>📅 Calendário de Prospecção Semanal</h2>
                            <p>Arraste os restaurantes para os horários disponíveis (8 prospecções por dia, das 08:00 às 18:00)</p>
                        </div>
                    </div>

                    {/* Barra de Ações Destacada */}
                    <div className={styles.actionBar}>
                        <div className={styles.primaryActions}>
                            <button
                                className={styles.actionBtnPrimary}
                                onClick={handleIntelligentAutoFill}
                                disabled={loading || carteiraRestaurants.length === 0}
                                title="Preencher automaticamente a semana priorizando os melhores restaurantes"
                            >
                                <span className={styles.actionIcon}>🤖</span>
                                <span className={styles.actionText}>
                                    {loading ? '⏳ Gerando...' : 'Preenchimento Inteligente'}
                                </span>
                            </button>
                            <button
                                className={styles.actionBtnSecondary}
                                onClick={handleExportToCheckmob}
                                disabled={true}
                                title="Em breve: Exportar para Checkmob"
                            >
                                <span className={styles.actionIcon}>📱</span>
                                <span className={styles.actionText}>Importar para Checkmob</span>
                            </button>
                            <button
                                className={styles.actionBtnSuccess}
                                onClick={handleExportExcel}
                                disabled={loading}
                                title="Exportar agenda semanal para planilha Excel profissional"
                            >
                                <span className={styles.actionIcon}>📊</span>
                                <span className={styles.actionText}>
                                    {loading ? '⏳ Gerando...' : 'Exportar Excel'}
                                </span>
                            </button>
                            <button
                                className={styles.actionBtnPurple}
                                onClick={handleExportAgendamento}
                                disabled={agendamentoExporting}
                                title="Exportar agenda semanal para template de agendamento"
                            >
                                <span className={styles.actionIcon}>📅</span>
                                <span className={styles.actionText}>
                                    {agendamentoExporting ? '⏳ Exportando...' : 'Exportar Agendamento'}
                                </span>
                            </button>
                        </div>
                        <div className={styles.secondaryActions}>
                            <div className={styles.weekViewToggle}>
                                <button
                                    className={`${styles.viewToggleBtn} ${weekViewMode === 'calendar' ? styles.active : ''}`}
                                    onClick={() => setWeekViewMode('calendar')}
                                >
                                    📅 Calendário
                                </button>
                                <button
                                    className={`${styles.viewToggleBtn} ${weekViewMode === 'list' ? styles.active : ''}`}
                                    onClick={() => setWeekViewMode('list')}
                                >
                                    📋 Lista
                                </button>
                            </div>
                            <div className={styles.weekNav}>
                                <button
                                    className={styles.weekNavBtn}
                                    onClick={() => {
                                        const newWeek = new Date(currentWeekStart);
                                        newWeek.setDate(newWeek.getDate() - 7);
                                        setCurrentWeekStart(newWeek);
                                    }}
                                >
                                    ← Semana Anterior
                                </button>
                                <button
                                    className={styles.weekNavBtn}
                                    onClick={() => {
                                        const newWeek = new Date(currentWeekStart);
                                        newWeek.setDate(newWeek.getDate() + 7);
                                        setCurrentWeekStart(newWeek);
                                    }}
                                >
                                    Próxima Semana →
                                </button>
                            </div>
                        </div>
                    </div>

                    {weekViewMode === 'calendar' ? (
                        <WeeklyCalendar
                            restaurants={carteiraRestaurants}
                            sellerId={selectedSellerId}
                            weekStart={currentWeekStart}
                        />
                    ) : (
                        <>
                            {weekPlan.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <span>📋</span>
                                    <h3>Nenhum cliente no plano</h3>
                                    <p>Adicione clientes da carteira clicando no botão "+" dos cards</p>
                                    <button 
                                        className={styles.primaryBtn}
                                        onClick={() => setActiveTab('carteira')}
                                    >
                                        Ir para Carteira
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.weekDays}>
                                        {weekDays.map(day => (
                                            <div 
                                                key={day.date} 
                                                className={`${styles.weekDay} ${day.isToday ? styles.today : ''}`}
                                            >
                                                <span className={styles.dayName}>{day.dayName}</span>
                                                <span className={styles.dayNum}>{day.dayNum}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={styles.weekPlanCards}>
                                        {weekPlanRestaurants.map((restaurant, index) => {
                                            const priority = getPriorityBadge(restaurant.salesPotential);
                                            
                                            return (
                                                <div key={restaurant.id} className={styles.weekPlanCard}>
                                                    <div className={styles.weekPlanOrder}>
                                                        <span>{index + 1}</span>
                                                    </div>
                                                    <div className={styles.weekPlanInfo}>
                                                        <h4>{restaurant.name}</h4>
                                                        <p>📍 {restaurant.address?.neighborhood || 'N/D'}</p>
                                                        <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                            {priority.label}
                                                        </span>
                                                    </div>
                                                    <div className={styles.weekPlanActions}>
                                                        <button 
                                                            className={styles.scheduleBtn}
                                                            onClick={() => setShowScheduleModal(restaurant.id)}
                                                        >
                                                            📅 Agendar
                                                        </button>
                                                        <button 
                                                            className={styles.removeBtn}
                                                            onClick={() => toggleWeekPlan(restaurant.id)}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className={styles.weekSummary}>
                                        <div className={styles.summaryCard}>
                                            <span>🎯</span>
                                            <div>
                                                <strong>{weekPlan.length}</strong>
                                                <span>Clientes para visitar</span>
                                            </div>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span>🔥</span>
                                            <div>
                                                <strong>
                                                    {weekPlanRestaurants.filter(r => 
                                                        r.salesPotential === 'ALTISSIMO' || r.salesPotential === 'ALTO'
                                                    ).length}
                                                </strong>
                                                <span>Hot Leads</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Agenda Tab */}
            {activeTab === 'agenda' && (
                <div className={styles.agendaSection}>
                    <div className={styles.agendaHeader}>
                        <h2>🗓️ Agenda Completa da Semana</h2>
                        <p>Visualização completa de todos os agendamentos da semana</p>
                    </div>
                    
                    {/* Agenda Semanal Completa */}
                    <div className={styles.fullWeekAgenda}>
                        {weekDays.map(day => {
                            const dayFollowUps = sellerFollowUps.filter(f => {
                                const followUpDate = new Date(f.scheduledDate).toISOString().split('T')[0];
                                return followUpDate === day.date;
                            });

                            return (
                                <div key={day.date} className={`${styles.agendaDay} ${day.isToday ? styles.today : ''}`}>
                                    <div className={styles.agendaDayHeader}>
                                        <div>
                                            <span className={styles.agendaDayName}>{day.dayName}</span>
                                            <span className={styles.agendaDayNum}>{day.dayNum}</span>
                                            <span className={styles.agendaDayMonth}>{day.month}</span>
                                        </div>
                                        <span className={styles.agendaDayCount}>{dayFollowUps.length} agendamentos</span>
                                    </div>
                                    <div className={styles.agendaDayContent}>
                                        {dayFollowUps.length === 0 ? (
                                            <p className={styles.noAgenda}>Nenhum agendamento</p>
                                        ) : (
                                            dayFollowUps
                                                .sort((a, b) => {
                                                    const timeA = new Date(a.scheduledDate).getTime();
                                                    const timeB = new Date(b.scheduledDate).getTime();
                                                    return timeA - timeB;
                                                })
                                                .map(followUp => {
                                                    const restaurant = restaurants.find(r => r.id === followUp.restaurantId);
                                                    if (!restaurant) return null;
                                                    const scheduledTime = new Date(followUp.scheduledDate);
                                                    const timeStr = scheduledTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                    const priority = getPriorityBadge(restaurant.salesPotential);
                                                    
                                                    return (
                                                        <div key={followUp.id} className={styles.agendaItem}>
                                                            <div className={styles.agendaItemTime}>{timeStr}</div>
                                                            <div className={styles.agendaItemContent}>
                                                                <strong>{restaurant.name}</strong>
                                                                <span>📍 {restaurant.address?.neighborhood || 'N/D'}</span>
                                                                <div className={styles.agendaItemMeta}>
                                                                    <span className={`${styles.priorityBadge} ${priority.class}`}>
                                                                        {priority.label}
                                                                    </span>
                                                                    <span className={styles.agendaItemType}>{followUp.type}</span>
                                                                </div>
                                                                {followUp.notes && (
                                                                    <p className={styles.agendaItemNotes}>{followUp.notes}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Histórico de Visitas */}
                    <div className={styles.visitHistorySection}>
                        <h3>📜 Histórico de Visitas</h3>
                        {sellerVisits.length === 0 ? (
                            <div className={styles.noVisits}>
                                <p>Nenhuma visita realizada</p>
                            </div>
                        ) : (
                            <div className={styles.historyList}>
                                {sellerVisits.slice(0, 10).map(visit => {
                                    const restaurant = restaurants.find(r => r.id === visit.restaurantId);
                                    if (!restaurant) return null;
                                    
                                    return (
                                        <div key={visit.id} className={styles.historyItem}>
                                            <div className={styles.historyDate}>
                                                {formatDate(visit.visitDate)}
                                            </div>
                                            <div className={styles.historyInfo}>
                                                <strong>{restaurant.name}</strong>
                                                {visit.outcome && (
                                                    <span className={`${styles.outcomeBadge} ${styles[visit.outcome.toLowerCase()]}`}>
                                                        {visit.outcome}
                                                    </span>
                                                )}
                                                {visit.feedback && <p>{visit.feedback}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Mapa Tab */}
            {activeTab === 'mapa' && (
                <MapaTecnologico 
                    restaurants={carteiraRestaurants} 
                    scheduledSlots={weeklyScheduledSlots}
                    weekStart={currentWeekStart}
                    sellerId={selectedSellerId}
                    onSuggestReorganization={(suggestions) => {
                        console.log('💡 Sugestões de reorganização:', suggestions);
                    }}
                    onScheduleUpdated={() => {
                        // Recarregar os agendamentos após otimização
                        loadWeeklySchedule();
                    }}
                />
            )}

            {/* Exportar Checkmob Tab */}
            {activeTab === 'exportar-checkmob' && (
                <div className={styles.checkmobExportContainer}>
                    <div className={styles.checkmobHeader}>
                        <h2>📥 Exportar para Checkmob - Cadastro de Clientes</h2>
                        <p>Filtre e selecione os clientes que deseja exportar no formato do template Checkmob</p>
                    </div>

                    {/* Filtros - Layout Compacto e Organizado */}
                    <div className={styles.checkmobFilters}>
                        <div className={styles.filterRow}>
                            <div className={styles.filterGroup}>
                                <label>👔 Executivo</label>
                                <select 
                                    value={checkmobFilterSeller} 
                                    onChange={e => setCheckmobFilterSeller(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {sellers.map(seller => (
                                        <option key={seller.id} value={seller.id}>{seller.name}</option>
                                    ))}
                                    <option value="sem-executivo">Sem Executivo</option>
                                </select>
                            </div>

                            <div className={styles.filterGroup}>
                                <label>📊 Status</label>
                                <select 
                                    value={checkmobFilterStatus} 
                                    onChange={e => setCheckmobFilterStatus(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="A Analisar">A Analisar</option>
                                    <option value="Qualificado">Qualificado</option>
                                    <option value="Contatado">Contatado</option>
                                    <option value="Negociação">Negociação</option>
                                    <option value="Fechado">Fechado</option>
                                </select>
                            </div>

                            <div className={styles.filterGroup}>
                                <label>🔥 Potencial</label>
                                <div className={styles.dropdownContainer}>
                                    <button
                                        type="button"
                                        className={styles.dropdownButton}
                                        onClick={() => setCheckmobPotentialDropdownOpen(!checkmobPotentialDropdownOpen)}
                                    >
                                        <span>
                                            {checkmobFilterPotential.length === 0 
                                                ? 'Todos' 
                                                : checkmobFilterPotential.length === 1
                                                ? checkmobFilterPotential[0]
                                                : `${checkmobFilterPotential.length} selecionados`}
                                        </span>
                                        <span className={styles.dropdownArrow}>
                                            {checkmobPotentialDropdownOpen ? '▲' : '▼'}
                                        </span>
                                    </button>
                                    {checkmobPotentialDropdownOpen && (
                                        <div className={styles.dropdownMenu}>
                                            <label className={styles.dropdownOption}>
                                                <input 
                                                    type="checkbox"
                                                    checked={checkmobFilterPotential.length === 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCheckmobFilterPotential([]);
                                                        }
                                                    }}
                                                />
                                                <span>Todos</span>
                                            </label>
                                            <label className={styles.dropdownOption}>
                                                <input 
                                                    type="checkbox"
                                                    checked={checkmobFilterPotential.includes('ALTÍSSIMO')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCheckmobFilterPotential([...checkmobFilterPotential, 'ALTÍSSIMO']);
                                                        } else {
                                                            setCheckmobFilterPotential(checkmobFilterPotential.filter(p => p !== 'ALTÍSSIMO'));
                                                        }
                                                    }}
                                                />
                                                <span>ALTÍSSIMO</span>
                                            </label>
                                            <label className={styles.dropdownOption}>
                                                <input 
                                                    type="checkbox"
                                                    checked={checkmobFilterPotential.includes('ALTO')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCheckmobFilterPotential([...checkmobFilterPotential, 'ALTO']);
                                                        } else {
                                                            setCheckmobFilterPotential(checkmobFilterPotential.filter(p => p !== 'ALTO'));
                                                        }
                                                    }}
                                                />
                                                <span>ALTO</span>
                                            </label>
                                            <label className={styles.dropdownOption}>
                                                <input 
                                                    type="checkbox"
                                                    checked={checkmobFilterPotential.includes('MÉDIO')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCheckmobFilterPotential([...checkmobFilterPotential, 'MÉDIO']);
                                                        } else {
                                                            setCheckmobFilterPotential(checkmobFilterPotential.filter(p => p !== 'MÉDIO'));
                                                        }
                                                    }}
                                                />
                                                <span>MÉDIO</span>
                                            </label>
                                            <label className={styles.dropdownOption}>
                                                <input 
                                                    type="checkbox"
                                                    checked={checkmobFilterPotential.includes('BAIXO')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCheckmobFilterPotential([...checkmobFilterPotential, 'BAIXO']);
                                                        } else {
                                                            setCheckmobFilterPotential(checkmobFilterPotential.filter(p => p !== 'BAIXO'));
                                                        }
                                                    }}
                                                />
                                                <span>BAIXO</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.filterGroup}>
                                <label>📍 Bairro</label>
                                <select 
                                    value={checkmobFilterNeighborhood} 
                                    onChange={e => setCheckmobFilterNeighborhood(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {checkmobNeighborhoods.filter(n => n !== 'all').map(neighborhood => (
                                        <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.filterRow}>
                            <div className={styles.filterGroup}>
                                <label>🏙️ Cidade</label>
                                <select 
                                    value={checkmobFilterCity} 
                                    onChange={e => setCheckmobFilterCity(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {checkmobCities.filter(c => c !== 'all').map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.filterGroup}>
                                <label>🗺️ Estado</label>
                                <select 
                                    value={checkmobFilterState} 
                                    onChange={e => setCheckmobFilterState(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {checkmobStates.filter(s => s !== 'all').map(state => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.filterGroup}>
                                <label className={styles.checkboxFilterLabel}>
                                    <input 
                                        type="checkbox" 
                                        checked={checkmobFilterHotLeads} 
                                        onChange={e => setCheckmobFilterHotLeads(e.target.checked)}
                                    />
                                    🔥 Leads Quentes (ALTÍSSIMO + Qualificado/Contatado)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Contador e Seleção */}
                    <div className={styles.checkmobSelectionHeader}>
                        <div className={styles.checkmobCount}>
                            <strong>{checkmobFilteredRestaurants.length}</strong> cliente(s) encontrado(s)
                            {checkmobSelectedRestaurants.size > 0 && (
                                <span style={{ marginLeft: '1rem', color: '#3b82f6', fontWeight: '600' }}>
                                    • {checkmobSelectedRestaurants.size} selecionado(s)
                                </span>
                            )}
                        </div>
                        <div className={styles.checkmobSelectAll}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={checkmobSelectedRestaurants.size === checkmobFilteredRestaurants.length && checkmobFilteredRestaurants.length > 0}
                                    onChange={handleCheckmobSelectAll}
                                />
                                Selecionar Todos
                            </label>
                        </div>
                    </div>

                    {/* Lista de Restaurantes */}
                    <div className={styles.checkmobRestaurantsList}>
                        {checkmobFilteredRestaurants.length === 0 ? (
                            <div className={styles.checkmobEmpty}>
                                <span>📭</span>
                                <p>Nenhum cliente encontrado com os filtros aplicados.</p>
                            </div>
                        ) : (
                            <div className={styles.checkmobTable}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px' }}></th>
                                            <th>Cliente</th>
                                            <th>Cidade</th>
                                            <th>Bairro</th>
                                            <th>Estado</th>
                                            <th>CEP</th>
                                            <th>Status</th>
                                            <th>Potencial</th>
                                            <th>Rating</th>
                                            <th>Avaliações</th>
                                            <th>Executivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checkmobFilteredRestaurants.map(restaurant => (
                                            <tr key={restaurant.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={checkmobSelectedRestaurants.has(restaurant.id)}
                                                        onChange={() => handleCheckmobSelectRestaurant(restaurant.id)}
                                                    />
                                                </td>
                                                <td><strong>{restaurant.name}</strong></td>
                                                <td>{restaurant.address?.city || '-'}</td>
                                                <td>{restaurant.address?.neighborhood || '-'}</td>
                                                <td>{restaurant.address?.state || '-'}</td>
                                                <td>{restaurant.address?.zip || restaurant.address?.cep || '-'}</td>
                                                <td>
                                                    <span className={styles.statusBadge} style={{
                                                        background: restaurant.status === 'Fechado' ? '#22c55e' :
                                                                    restaurant.status === 'Negociação' ? '#f59e0b' :
                                                                    restaurant.status === 'Contatado' ? '#3b82f6' :
                                                                    restaurant.status === 'Qualificado' ? '#10b981' : '#6366f1',
                                                        color: 'white',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        {restaurant.status || 'A Analisar'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={styles.potentialBadge} style={{
                                                        background: restaurant.salesPotential === 'ALTÍSSIMO' ? '#ef4444' :
                                                                    restaurant.salesPotential === 'ALTO' ? '#f59e0b' :
                                                                    restaurant.salesPotential === 'MÉDIO' ? '#3b82f6' : '#94a3b8',
                                                        color: 'white',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        {restaurant.salesPotential || '-'}
                                                    </span>
                                                </td>
                                                <td>⭐ {restaurant.rating?.toFixed(1) || '0.0'}</td>
                                                <td>{restaurant.reviewCount || 0}</td>
                                                <td>{restaurant.sellerName || 'Sem executivo'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Botão de Exportação */}
                    <div className={styles.checkmobExportActions}>
                        <button
                            className={styles.checkmobExportButton}
                            onClick={handleExportToCheckmob}
                            disabled={checkmobExporting || checkmobFilteredRestaurants.length === 0}
                        >
                            {checkmobExporting ? '⏳ Exportando...' : '📥 Baixar Planilha Checkmob Cadastro'}
                        </button>
                        {checkmobSelectedRestaurants.size > 0 && (
                            <span className={styles.checkmobExportHint}>
                                Exportando {checkmobSelectedRestaurants.size} cliente(s) selecionado(s)
                            </span>
                        )}
                        {checkmobSelectedRestaurants.size === 0 && checkmobFilteredRestaurants.length > 0 && (
                            <span className={styles.checkmobExportHint}>
                                Exportando todos os {checkmobFilteredRestaurants.length} cliente(s) filtrado(s)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Clientes Fixos Tab */}
            {activeTab === 'clientes-fixos' && (
                <FixedClientsSection 
                    sellerId={selectedSellerId}
                    restaurants={carteiraRestaurants}
                />
            )}

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div className={styles.modalOverlay} onClick={() => setShowScheduleModal(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>📅 Agendar Visita</h2>
                            <button className={styles.closeBtn} onClick={() => setShowScheduleModal(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.field}>
                                <label>Data da Visita</label>
                                <input
                                    type="date"
                                    value={scheduleData.date}
                                    onChange={e => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Horário (opcional)</label>
                                <input
                                    type="time"
                                    value={scheduleData.time}
                                    onChange={e => setScheduleData(prev => ({ ...prev, time: e.target.value }))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Observações</label>
                                <textarea
                                    value={scheduleData.notes}
                                    onChange={e => setScheduleData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Notas sobre a visita..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button 
                                className={styles.cancelBtn}
                                onClick={() => setShowScheduleModal(null)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className={styles.confirmBtn}
                                onClick={handleScheduleVisit}
                                disabled={!scheduleData.date || loading}
                            >
                                {loading ? 'Agendando...' : '✓ Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick View Modal */}
            {quickViewId && quickViewRestaurant && (
                <div className={styles.modalOverlay} onClick={() => setQuickViewId(null)}>
                    <div className={styles.quickViewModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.quickViewHeader}>
                            <div className={styles.quickViewTitle}>
                                <h2>{quickViewRestaurant.name}</h2>
                                <span className={styles.quickViewLocation}>
                                    📍 {quickViewRestaurant.address?.neighborhood || 'N/D'}, {quickViewRestaurant.address?.city || ''}
                                </span>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setQuickViewId(null)}>✕</button>
                        </div>

                        <div className={styles.quickViewTabs}>
                            <button 
                                className={`${styles.qvTab} ${quickViewTab === 'info' ? styles.active : ''}`}
                                onClick={() => setQuickViewTab('info')}
                            >
                                📋 Informações
                            </button>
                            <button 
                                className={`${styles.qvTab} ${quickViewTab === 'actions' ? styles.active : ''}`}
                                onClick={() => setQuickViewTab('actions')}
                            >
                                ⚡ Ações Rápidas
                            </button>
                            <button 
                                className={`${styles.qvTab} ${quickViewTab === 'notes' ? styles.active : ''}`}
                                onClick={() => setQuickViewTab('notes')}
                            >
                                📝 Notas
                            </button>
                            <button 
                                className={`${styles.qvTab} ${quickViewTab === 'history' ? styles.active : ''}`}
                                onClick={() => setQuickViewTab('history')}
                            >
                                📜 Histórico
                            </button>
                        </div>

                        <div className={styles.quickViewContent}>
                            {/* Info Tab */}
                            {quickViewTab === 'info' && (
                                <div className={styles.qvInfoTab}>
                                    <div className={styles.qvInfoGrid}>
                                        <div className={styles.qvInfoCard}>
                                            <span className={styles.qvInfoIcon}>⭐</span>
                                            <div>
                                                <strong>{quickViewRestaurant.rating?.toFixed(1) || 'N/D'}</strong>
                                                <span>Avaliação</span>
                                            </div>
                                        </div>
                                        <div className={styles.qvInfoCard}>
                                            <span className={styles.qvInfoIcon}>💬</span>
                                            <div>
                                                <strong>{quickViewRestaurant.commentsCount}</strong>
                                                <span>Comentários</span>
                                            </div>
                                        </div>
                                        <div className={styles.qvInfoCard}>
                                            <span className={styles.qvInfoIcon}>📦</span>
                                            <div>
                                                <strong>{quickViewRestaurant.projectedDeliveries || 0}</strong>
                                                <span>Entregas/mês</span>
                                            </div>
                                        </div>
                                        <div className={styles.qvInfoCard}>
                                            <span className={styles.qvInfoIcon}>📊</span>
                                            <div>
                                                <strong>{quickViewRestaurant.reviewCount || 0}</strong>
                                                <span>Reviews</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.qvStatusSection}>
                                        <div className={styles.qvStatusItem}>
                                            <label>Status:</label>
                                            {editingStatus === quickViewId ? (
                                                <select 
                                                    value={quickViewRestaurant.status}
                                                    onChange={e => handleUpdateStatus(quickViewId, e.target.value)}
                                                    disabled={loading}
                                                >
                                                    <option value="A Analisar">A Analisar</option>
                                                    <option value="Qualificado">Qualificado</option>
                                                    <option value="Contatado">Contatado</option>
                                                    <option value="Negociação">Negociação</option>
                                                    <option value="Fechado">Fechado</option>
                                                </select>
                                            ) : (
                                                <span 
                                                    className={`${styles.statusBadge} ${getStatusBadge(quickViewRestaurant.status)} ${styles.clickable}`}
                                                    onClick={() => setEditingStatus(quickViewId)}
                                                >
                                                    {quickViewRestaurant.status} ✏️
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.qvStatusItem}>
                                            <label>Potencial:</label>
                                            {editingPriority === quickViewId ? (
                                                <select 
                                                    value={quickViewRestaurant.salesPotential || ''}
                                                    onChange={e => handleUpdatePriority(quickViewId, e.target.value)}
                                                    disabled={loading}
                                                >
                                                    <option value="ALTISSIMO">🔥 Altíssimo</option>
                                                    <option value="ALTO">⬆️ Alto</option>
                                                    <option value="MEDIO">➡️ Médio</option>
                                                    <option value="BAIXO">⬇️ Baixo</option>
                                                </select>
                                            ) : (
                                                <span 
                                                    className={`${styles.priorityBadge} ${getPriorityBadge(quickViewRestaurant.salesPotential).class} ${styles.clickable}`}
                                                    onClick={() => setEditingPriority(quickViewId)}
                                                >
                                                    {getPriorityBadge(quickViewRestaurant.salesPotential).label} ✏️
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.qvAddress}>
                                        <h4>📍 Endereço Completo</h4>
                                        <p>
                                            {quickViewRestaurant.address?.street || ''} 
                                            {quickViewRestaurant.address?.number ? `, ${quickViewRestaurant.address.number}` : ''}
                                        </p>
                                        <p>
                                            {quickViewRestaurant.address?.neighborhood || ''} - {quickViewRestaurant.address?.city || ''}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Actions Tab */}
                            {quickViewTab === 'actions' && (
                                <div className={styles.qvActionsTab}>
                                    <div className={styles.qvActionsList}>
                                        <button 
                                            className={styles.qvActionBtn}
                                            onClick={() => {
                                                setQuickViewId(null);
                                                setShowScheduleModal(quickViewId);
                                            }}
                                        >
                                            <span>📅</span>
                                            <div>
                                                <strong>Agendar Visita</strong>
                                                <span>Marcar uma visita presencial</span>
                                            </div>
                                        </button>
                                        <button 
                                            className={styles.qvActionBtn}
                                            onClick={() => toggleWeekPlan(quickViewId)}
                                        >
                                            <span>{weekPlan.includes(quickViewId) ? '✓' : '+'}</span>
                                            <div>
                                                <strong>{weekPlan.includes(quickViewId) ? 'Remover do Plano' : 'Adicionar ao Plano'}</strong>
                                                <span>Plano de visitas da semana</span>
                                            </div>
                                        </button>
                                        <button 
                                            className={styles.qvActionBtn}
                                            onClick={() => setQuickViewTab('notes')}
                                        >
                                            <span>📝</span>
                                            <div>
                                                <strong>Adicionar Nota</strong>
                                                <span>Registrar observação</span>
                                            </div>
                                        </button>
                                        <a 
                                            href={`/restaurant/${quickViewId}`}
                                            className={styles.qvActionBtn}
                                            target="_blank"
                                        >
                                            <span>🔗</span>
                                            <div>
                                                <strong>Abrir Página Completa</strong>
                                                <span>Ver todos os detalhes</span>
                                            </div>
                                        </a>
                                    </div>

                                    <div className={styles.qvQuickStatus}>
                                        <h4>⚡ Alterar Status Rápido</h4>
                                        <div className={styles.qvStatusBtns}>
                                            {['A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'].map(status => (
                                                <button
                                                    key={status}
                                                    className={`${styles.qvStatusBtn} ${quickViewRestaurant.status === status ? styles.active : ''}`}
                                                    onClick={() => handleUpdateStatus(quickViewId, status)}
                                                    disabled={loading}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes Tab */}
                            {quickViewTab === 'notes' && (
                                <div className={styles.qvNotesTab}>
                                    <div className={styles.qvAddNote}>
                                        <textarea
                                            value={newNote}
                                            onChange={e => setNewNote(e.target.value)}
                                            placeholder="Digite uma nota rápida sobre este cliente..."
                                            rows={3}
                                        />
                                        <button 
                                            className={styles.qvAddNoteBtn}
                                            onClick={handleAddNote}
                                            disabled={!newNote.trim() || loading}
                                        >
                                            {loading ? 'Salvando...' : '💾 Salvar Nota'}
                                        </button>
                                    </div>
                                    
                                    <div className={styles.qvNotesList}>
                                        <h4>📝 Notas Anteriores</h4>
                                        {quickViewFollowUps.filter(f => f.notes).length === 0 ? (
                                            <p className={styles.qvNoNotes}>Nenhuma nota registrada</p>
                                        ) : (
                                            quickViewFollowUps.filter(f => f.notes).map(f => (
                                                <div key={f.id} className={styles.qvNoteItem}>
                                                    <span className={styles.qvNoteDate}>
                                                        {new Date(f.scheduledDate).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    <p>{f.notes}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* History Tab */}
                            {quickViewTab === 'history' && (
                                <div className={styles.qvHistoryTab}>
                                    <div className={styles.qvTimeline}>
                                        {quickViewFollowUps.length === 0 && quickViewVisits.length === 0 ? (
                                            <p className={styles.qvNoHistory}>Nenhum histórico registrado</p>
                                        ) : (
                                            <>
                                                {quickViewFollowUps.map(f => (
                                                    <div key={f.id} className={styles.qvTimelineItem}>
                                                        <div className={styles.qvTimelineDot}></div>
                                                        <div className={styles.qvTimelineContent}>
                                                            <span className={styles.qvTimelineDate}>
                                                                {new Date(f.scheduledDate).toLocaleDateString('pt-BR')}
                                                            </span>
                                                            <strong>📅 {f.type}</strong>
                                                            {f.notes && <p>{f.notes}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {quickViewVisits.map(v => (
                                                    <div key={v.id} className={styles.qvTimelineItem}>
                                                        <div className={`${styles.qvTimelineDot} ${styles.visit}`}></div>
                                                        <div className={styles.qvTimelineContent}>
                                                            <span className={styles.qvTimelineDate}>
                                                                {new Date(v.visitDate).toLocaleDateString('pt-BR')}
                                                            </span>
                                                            <strong>👤 Visita Realizada</strong>
                                                            {v.outcome && <span className={styles.qvOutcome}>{v.outcome}</span>}
                                                            {v.feedback && <p>{v.feedback}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmação Inteligente */}
            {currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length && (
                <ConfirmationModal
                    suggestion={suggestions[currentSuggestionIndex]}
                    isOpen={true}
                    onConfirm={handleModalConfirm}
                    onCancel={handleModalCancel}
                    onSkip={handleModalSkip}
                />
            )}
        </div>
    );
}

