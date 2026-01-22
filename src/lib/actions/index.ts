// Re-exports centralizados de todas as actions
// Este arquivo serve como ponto único de importação

// Actions de clientes
export {
    updateRestaurantStatus,
    updateRestaurantSeller,
    addNote,
    generateMissingCodigosCliente,
    checkCodigoClienteStatus,
    getNextCodigoCliente,
    createSystemNotification
} from './clientes';

// Actions de IA
export {
    performAnalysis,
    analyzeBatch,
    generateEmailWithAI,
    generateStrategyWithAI,
    generateFollowUpMessageWithAI
} from './ia';

// Actions de pipeline
export {
    createFollowUp,
    sendEmail,
    completeFollowUp
} from './pipeline';

// Actions de metas
export {
    updateGoal
} from './metas';

// Actions de Análise de Embalagem
export {
    analyzePackagingComments,
    calculateLeadPriority,
    reprocessAllRestaurants
} from './packaging-analysis';

// Actions de importação permanecem em app/actions.ts por enquanto
// devido ao tamanho e complexidade (será refatorado em etapa futura)
