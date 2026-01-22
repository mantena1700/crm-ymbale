// Re-exports das actions de carteira
// Mantém compatibilidade com código existente

// Por enquanto, re-exporta tudo do arquivo original
// Em uma refatoração futura, podemos dividir em módulos menores
export {
    scheduleVisit,
    updateClientPriority,
    updateClientStatus,
    addNote,
    assignClientToSeller,
    getCarteiraStats,
    completeVisit,
    saveWeeklySchedule,
    deleteMultipleScheduleSlots,
    autoFillWeeklySchedule,
    getWeeklySchedule,
    applyScheduleReorganization,
    autoOptimizeWeekSchedule,
    exportWeeklyScheduleToExcel,
    exportWeeklyScheduleToAgendamentoTemplate,
    getFixedClients,
    createFixedClient,
    updateFixedClient,
    deleteFixedClient,
    getFixedClientsForWeek,
    findNearbyProspectClients
} from '../../app/carteira/actions';
