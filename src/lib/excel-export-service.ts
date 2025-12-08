import ExcelJS from 'exceljs';

interface RestaurantAddress {
    street: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode?: string | null;
}

interface Restaurant {
    id: string;
    name: string;
    address: RestaurantAddress | null;
    salesPotential: string | null;
    rating: number;
    status: string;
    projectedDeliveries: number;
    reviewCount: number;
}

interface FollowUp {
    id: string;
    scheduledDate: Date;
    completed: boolean;
    notes: string | null;
    restaurant: Restaurant;
}

interface Seller {
    id: string;
    name: string;
    email: string | null;
    regions: string[];
    neighborhoods: string[];
}

interface WeeklyScheduleData {
    seller: Seller;
    weekStart: Date;
    followUps: FollowUp[];
    restaurants: Restaurant[];
}

/**
 * Cria uma planilha Excel profissional e completa com a agenda semanal do vendedor
 */
export async function createWeeklyScheduleExcel(data: WeeklyScheduleData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Metadados da planilha
    workbook.creator = 'CRM Ymbale - Sistema Inteligente de Gestão';
    workbook.lastModifiedBy = 'Sistema Automático';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = false;

    // 1. ABA DASHBOARD EXECUTIVO
    await createDashboardSheet(workbook, data);

    // 2. ABA CALENDÁRIO SEMANAL
    await createCalendarSheet(workbook, data);

    // 3. ABA LISTA DETALHADA DE VISITAS
    await createDetailedVisitsSheet(workbook, data);

    // 4. ABA ANÁLISE DE PERFORMANCE
    await createPerformanceSheet(workbook, data);

    // 5. ABA MAPA DE CALOR (HEATMAP)
    await createHeatmapSheet(workbook, data);

    // 6. ABA RESTAURANTES PRIORIZADOS
    await createPrioritizedRestaurantsSheet(workbook, data);

    // 7. ABA RESUMO EXECUTIVO
    await createExecutiveSummarySheet(workbook, data);

    // Retornar como buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * ABA 1: Dashboard Executivo com métricas e KPIs
 */
async function createDashboardSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('📊 Dashboard', {
        properties: { tabColor: { argb: 'FF6366F1' } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
    });

    // Configurar colunas
    sheet.columns = [
        { width: 3 },
        { width: 25 },
        { width: 20 },
        { width: 20 },
        { width: 20 },
        { width: 20 },
        { width: 3 },
    ];

    // Título principal
    sheet.mergeCells('B2:F2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = '📊 DASHBOARD EXECUTIVO - AGENDA SEMANAL';
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' }
    };
    sheet.getRow(2).height = 40;

    // Informações do vendedor
    sheet.mergeCells('B4:F4');
    const sellerCell = sheet.getCell('B4');
    sellerCell.value = `Vendedor: ${data.seller.name} | ${data.seller.email || 'Sem email'}`;
    sellerCell.font = { name: 'Calibri', size: 14, bold: true };
    sellerCell.alignment = { horizontal: 'center' };
    sellerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
    };

    // Período
    const weekEnd = new Date(data.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    sheet.mergeCells('B5:F5');
    const periodCell = sheet.getCell('B5');
    periodCell.value = `Período: ${data.weekStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')}`;
    periodCell.font = { name: 'Calibri', size: 12 };
    periodCell.alignment = { horizontal: 'center' };

    // Calcular métricas
    const totalVisits = data.followUps.length;
    const completedVisits = data.followUps.filter(f => f.completed).length;
    const pendingVisits = totalVisits - completedVisits;
    const completionRate = totalVisits > 0 ? (completedVisits / totalVisits * 100).toFixed(1) : '0.0';
    
    const restaurantsByPotential = {
        ALTISSIMO: data.restaurants.filter(r => r.salesPotential === 'ALTISSIMO').length,
        ALTO: data.restaurants.filter(r => r.salesPotential === 'ALTO').length,
        MEDIO: data.restaurants.filter(r => r.salesPotential === 'MEDIO').length,
        BAIXO: data.restaurants.filter(r => r.salesPotential === 'BAIXO').length,
    };

    const avgRating = data.restaurants.length > 0
        ? (data.restaurants.reduce((sum, r) => sum + r.rating, 0) / data.restaurants.length).toFixed(1)
        : '0.0';

    // KPIs - Cards coloridos
    let currentRow = 7;
    const kpis = [
        { label: '🎯 Total de Visitas', value: totalVisits, color: 'FF3B82F6', icon: '📅' },
        { label: '✅ Concluídas', value: completedVisits, color: 'FF10B981', icon: '✓' },
        { label: '⏳ Pendentes', value: pendingVisits, color: 'FFFBBF24', icon: '⌛' },
        { label: '📊 Taxa de Conclusão', value: `${completionRate}%`, color: 'FF8B5CF6', icon: '📈' },
        { label: '⭐ Avaliação Média', value: avgRating, color: 'FFEF4444', icon: '⭐' },
        { label: '🔥 Altíssimo Potencial', value: restaurantsByPotential.ALTISSIMO, color: 'FFDC2626', icon: '🔥' },
    ];

    kpis.forEach((kpi, index) => {
        const row = currentRow + Math.floor(index / 3) * 3;
        const colStart = 2 + (index % 3) * 2;
        const colEnd = colStart + 1;

        sheet.mergeCells(row, colStart, row, colEnd);
        const kpiCell = sheet.getCell(row, colStart);
        kpiCell.value = kpi.label;
        kpiCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        kpiCell.alignment = { horizontal: 'center', vertical: 'middle' };
        kpiCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: kpi.color }
        };
        sheet.getRow(row).height = 25;

        sheet.mergeCells(row + 1, colStart, row + 1, colEnd);
        const valueCell = sheet.getCell(row + 1, colStart);
        valueCell.value = kpi.value;
        valueCell.font = { name: 'Calibri', size: 24, bold: true };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
        valueCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
        };
        sheet.getRow(row + 1).height = 45;

        // Borda
        [kpiCell, valueCell].forEach(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        });
    });

    // Distribuição por dia da semana
    currentRow += 8;
    sheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const distTitle = sheet.getCell(`B${currentRow}`);
    distTitle.value = '📅 DISTRIBUIÇÃO DE VISITAS POR DIA';
    distTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    distTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    distTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' }
    };
    sheet.getRow(currentRow).height = 30;

    currentRow++;
    const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const visitsByDay = new Array(7).fill(0);
    
    data.followUps.forEach(f => {
        const dayIndex = new Date(f.scheduledDate).getDay();
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Ajustar domingo para o fim
        visitsByDay[adjustedIndex]++;
    });

    // Header
    sheet.getCell(`B${currentRow}`).value = 'Dia';
    sheet.getCell(`C${currentRow}`).value = 'Visitas';
    sheet.getCell(`D${currentRow}`).value = 'Gráfico';
    ['B', 'C', 'D'].forEach(col => {
        const cell = sheet.getCell(`${col}${currentRow}`);
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' }
        };
        cell.alignment = { horizontal: 'center' };
    });

    currentRow++;
    daysOfWeek.forEach((day, index) => {
        const row = currentRow + index;
        sheet.getCell(`B${row}`).value = day;
        sheet.getCell(`C${row}`).value = visitsByDay[index];
        
        // Barra de progresso visual
        const maxVisits = Math.max(...visitsByDay, 1);
        const percentage = (visitsByDay[index] / maxVisits * 100).toFixed(0);
        sheet.getCell(`D${row}`).value = '█'.repeat(Math.floor(Number(percentage) / 10)) + ` ${visitsByDay[index]}`;
        
        // Colorir baseado na quantidade
        const color = visitsByDay[index] >= 8 ? 'FF10B981' : visitsByDay[index] >= 5 ? 'FFFBBF24' : 'FFEF4444';
        sheet.getCell(`C${row}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
        };
        sheet.getCell(`C${row}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
}

/**
 * ABA 2: Calendário Semanal Visual
 */
async function createCalendarSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('📅 Calendário', {
        properties: { tabColor: { argb: 'FF10B981' } },
    });

    // Configurar colunas
    sheet.columns = [
        { width: 3 },
        { width: 12 },
        { width: 30 },
        { width: 30 },
        { width: 30 },
        { width: 30 },
        { width: 30 },
        { width: 30 },
        { width: 30 },
        { width: 3 },
    ];

    // Título
    sheet.mergeCells('B2:I2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = '📅 CALENDÁRIO SEMANAL DE PROSPECÇÃO';
    titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' }
    };
    sheet.getRow(2).height = 35;

    // Horários
    const timeSlots = ['08:00', '09:15', '10:30', '11:45', '13:00', '14:15', '15:30', '16:45'];
    
    // Header com dias da semana
    const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    let currentRow = 4;
    
    sheet.getCell(`B${currentRow}`).value = 'Horário';
    daysOfWeek.forEach((day, index) => {
        const date = new Date(data.weekStart);
        date.setDate(date.getDate() + index);
        const cell = sheet.getCell(currentRow, 3 + index);
        cell.value = `${day}\n${date.toLocaleDateString('pt-BR')}`;
        cell.font = { bold: true, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF6366F1' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    
    // Horário header
    const hourCell = sheet.getCell(`B${currentRow}`);
    hourCell.font = { bold: true };
    hourCell.alignment = { horizontal: 'center', vertical: 'middle' };
    hourCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
    };
    sheet.getRow(currentRow).height = 35;

    // Preencher grade de horários
    currentRow++;
    timeSlots.forEach(time => {
        sheet.getCell(`B${currentRow}`).value = time;
        sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getCell(`B${currentRow}`).font = { bold: true };
        sheet.getCell(`B${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
        };

        daysOfWeek.forEach((day, dayIndex) => {
            const date = new Date(data.weekStart);
            date.setDate(date.getDate() + dayIndex);
            
            // Buscar follow-up para este horário
            const followUp = data.followUps.find(f => {
                const fDate = new Date(f.scheduledDate);
                const fTime = `${String(fDate.getHours()).padStart(2, '0')}:${String(fDate.getMinutes()).padStart(2, '0')}`;
                const fDateString = fDate.toISOString().split('T')[0];
                const targetDateString = date.toISOString().split('T')[0];
                return fTime === time && fDateString === targetDateString;
            });

            const cell = sheet.getCell(currentRow, 3 + dayIndex);
            if (followUp) {
                cell.value = {
                    richText: [
                        { text: `${followUp.restaurant.name}\n`, font: { bold: true, size: 10 } },
                        { text: `📍 ${followUp.restaurant.address?.neighborhood || 'N/A'}\n`, font: { size: 9, color: { argb: 'FF6B7280' } } },
                        { text: `⭐ ${followUp.restaurant.rating ? followUp.restaurant.rating.toFixed(1) : 'N/D'} | 🎯 ${followUp.restaurant.salesPotential || 'N/A'}`, font: { size: 8, color: { argb: 'FF6B7280' } } },
                    ]
                };
                
                // Colorir baseado no potencial
                let color = 'FFF3F4F6';
                if (followUp.restaurant.salesPotential === 'ALTISSIMO') color = 'FFEF4444';
                else if (followUp.restaurant.salesPotential === 'ALTO') color = 'FFFBBF24';
                else if (followUp.restaurant.salesPotential === 'MEDIO') color = 'FF3B82F6';
                
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: color }
                };
                
                if (followUp.completed) {
                    cell.font = { strikethrough: true };
                }
            } else {
                cell.value = '—';
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFAFAFA' }
                };
            }
            
            cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        });

        sheet.getRow(currentRow).height = 60;
        currentRow++;
    });

    // Legenda
    currentRow += 2;
    sheet.mergeCells(`B${currentRow}:I${currentRow}`);
    const legendTitle = sheet.getCell(`B${currentRow}`);
    legendTitle.value = 'LEGENDA DE CORES';
    legendTitle.font = { bold: true, size: 12 };
    legendTitle.alignment = { horizontal: 'center' };
    
    currentRow++;
    const legends = [
        { label: '🔥 Altíssimo Potencial', color: 'FFEF4444' },
        { label: '⬆️ Alto Potencial', color: 'FFFBBF24' },
        { label: '➡️ Médio Potencial', color: 'FF3B82F6' },
        { label: '⬇️ Baixo Potencial', color: 'FFF3F4F6' },
    ];

    legends.forEach((legend, index) => {
        const col = 2 + index * 2;
        sheet.mergeCells(currentRow, col, currentRow, col + 1);
        const cell = sheet.getCell(currentRow, col);
        cell.value = legend.label;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: legend.color }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, size: 10 };
    });
}

/**
 * ABA 3: Lista Detalhada de Visitas
 */
async function createDetailedVisitsSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('📋 Lista Detalhada', {
        properties: { tabColor: { argb: 'FFFBBF24' } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
    });

    // Título
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '📋 LISTA DETALHADA DE VISITAS AGENDADAS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFBBF24' }
    };
    sheet.getRow(1).height = 30;

    // Headers
    const headers = ['#', 'Data', 'Hora', 'Restaurante', 'Endereço', 'Bairro', 'Avaliação', 'Potencial', 'Status', 'Observações'];
    sheet.getRow(2).values = headers;
    sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' }
    };
    sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 25;

    // Configurar larguras
    sheet.columns = [
        { width: 5 },  // #
        { width: 12 }, // Data
        { width: 8 },  // Hora
        { width: 35 }, // Restaurante
        { width: 30 }, // Endereço
        { width: 20 }, // Bairro
        { width: 10 }, // Avaliação
        { width: 15 }, // Potencial
        { width: 12 }, // Status
        { width: 40 }, // Observações
    ];

    // Ordenar follow-ups por data
    const sortedFollowUps = [...data.followUps].sort((a, b) => 
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );

    // Preencher dados
    sortedFollowUps.forEach((followUp, index) => {
        const row = index + 3;
        const date = new Date(followUp.scheduledDate);
        
        sheet.getCell(`A${row}`).value = index + 1;
        sheet.getCell(`B${row}`).value = date.toLocaleDateString('pt-BR');
        sheet.getCell(`C${row}`).value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        sheet.getCell(`D${row}`).value = followUp.restaurant.name;
        sheet.getCell(`E${row}`).value = followUp.restaurant.address?.street || 'N/A';
        sheet.getCell(`F${row}`).value = followUp.restaurant.address?.neighborhood || 'N/A';
        sheet.getCell(`G${row}`).value = followUp.restaurant.rating ? followUp.restaurant.rating.toFixed(1) : 'N/D';
        sheet.getCell(`H${row}`).value = followUp.restaurant.salesPotential || 'N/A';
        sheet.getCell(`I${row}`).value = followUp.completed ? '✅ Concluída' : '⏳ Pendente';
        sheet.getCell(`J${row}`).value = followUp.notes || '';

        // Formatação alternada
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(col => {
            const cell = sheet.getCell(`${col}${row}`);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: fillColor }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });

        // Colorir potencial
        const potentialCell = sheet.getCell(`H${row}`);
        let color = 'FFF3F4F6';
        if (followUp.restaurant.salesPotential === 'ALTISSIMO') color = 'FFEF4444';
        else if (followUp.restaurant.salesPotential === 'ALTO') color = 'FFFBBF24';
        else if (followUp.restaurant.salesPotential === 'MEDIO') color = 'FF3B82F6';
        
        potentialCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
        };
        potentialCell.font = { bold: true };

        // Altura da linha
        sheet.getRow(row).height = 35;
    });

    // Aplicar auto-filter
    sheet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: sortedFollowUps.length + 2, column: 10 }
    };
}

/**
 * ABA 4: Análise de Performance
 */
async function createPerformanceSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('📈 Performance', {
        properties: { tabColor: { argb: 'FF8B5CF6' } },
    });

    sheet.columns = [
        { width: 3 },
        { width: 30 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 25 },
        { width: 3 },
    ];

    // Título
    sheet.mergeCells('B2:F2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = '📈 ANÁLISE DE PERFORMANCE E PRODUTIVIDADE';
    titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8B5CF6' }
    };
    sheet.getRow(2).height = 35;

    let currentRow = 4;

    // Métricas de produtividade
    sheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const metricsTitle = sheet.getCell(`B${currentRow}`);
    metricsTitle.value = '⏱️ MÉTRICAS DE PRODUTIVIDADE';
    metricsTitle.font = { bold: true, size: 14 };
    metricsTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
    };
    metricsTitle.alignment = { horizontal: 'center' };

    currentRow++;
    const totalVisits = data.followUps.length;
    const workDays = 5;
    const visitsPerDay = (totalVisits / workDays).toFixed(1);
    const hoursPerVisit = totalVisits > 0 ? (40 / totalVisits).toFixed(1) : '0';
    const projectedRevenue = data.restaurants.reduce((sum, r) => sum + r.projectedDeliveries, 0);

    const metrics = [
        ['📊 Total de Visitas Agendadas', totalVisits, 'visitas'],
        ['📅 Média de Visitas por Dia', visitsPerDay, 'visitas/dia'],
        ['⏰ Tempo Médio por Visita', hoursPerVisit, 'horas'],
        ['💰 Receita Projetada Total', `R$ ${projectedRevenue.toFixed(2)}`, 'estimado'],
        ['🎯 Taxa de Ocupação da Agenda', `${((totalVisits / 40) * 100).toFixed(1)}%`, 'de 40 slots'],
    ];

    metrics.forEach(([label, value, unit]) => {
        sheet.getCell(`B${currentRow}`).value = label;
        sheet.getCell(`D${currentRow}`).value = value;
        sheet.getCell(`E${currentRow}`).value = unit;
        
        ['B', 'C', 'D', 'E', 'F'].forEach(col => {
            const cell = sheet.getCell(`${col}${currentRow}`);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        });
        
        sheet.getCell(`B${currentRow}`).font = { bold: true };
        sheet.getCell(`D${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FF6366F1' } };
        sheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center' };
        
        currentRow++;
    });

    // Análise por potencial
    currentRow += 2;
    sheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const potentialTitle = sheet.getCell(`B${currentRow}`);
    potentialTitle.value = '🎯 DISTRIBUIÇÃO POR POTENCIAL DE VENDAS';
    potentialTitle.font = { bold: true, size: 14 };
    potentialTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
    };
    potentialTitle.alignment = { horizontal: 'center' };

    currentRow++;
    const potentials = ['ALTISSIMO', 'ALTO', 'MEDIO', 'BAIXO'];
    const potentialCounts = potentials.map(p => 
        data.followUps.filter(f => f.restaurant.salesPotential === p).length
    );

    // Header
    sheet.getCell(`B${currentRow}`).value = 'Potencial';
    sheet.getCell(`C${currentRow}`).value = 'Quantidade';
    sheet.getCell(`D${currentRow}`).value = '%';
    sheet.getCell(`E${currentRow}`).value = 'Visualização';
    ['B', 'C', 'D', 'E'].forEach(col => {
        const cell = sheet.getCell(`${col}${currentRow}`);
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
        };
    });

    currentRow++;
    potentials.forEach((potential, index) => {
        const count = potentialCounts[index];
        const percentage = totalVisits > 0 ? ((count / totalVisits) * 100).toFixed(1) : '0.0';
        
        sheet.getCell(`B${currentRow}`).value = potential;
        sheet.getCell(`C${currentRow}`).value = count;
        sheet.getCell(`D${currentRow}`).value = `${percentage}%`;
        sheet.getCell(`E${currentRow}`).value = '█'.repeat(Math.floor(Number(percentage) / 5)) + ` ${count}`;
        
        // Colorir
        let color = 'FFF3F4F6';
        if (potential === 'ALTISSIMO') color = 'FFEF4444';
        else if (potential === 'ALTO') color = 'FFFBBF24';
        else if (potential === 'MEDIO') color = 'FF3B82F6';
        
        sheet.getCell(`B${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
        };
        sheet.getCell(`B${currentRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        currentRow++;
    });
}

/**
 * ABA 5: Mapa de Calor (Heatmap) de Horários
 */
async function createHeatmapSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('🔥 Mapa de Calor', {
        properties: { tabColor: { argb: 'FFEF4444' } },
    });

    // Título
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '🔥 MAPA DE CALOR - DISTRIBUIÇÃO DE VISITAS POR HORÁRIO';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' }
    };
    sheet.getRow(1).height = 30;

    // Criar matriz de horários x dias
    const timeSlots = ['08:00', '09:15', '10:30', '11:45', '13:00', '14:15', '15:30', '16:45'];
    const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    // Header com dias
    sheet.getCell('A3').value = 'Horário';
    daysOfWeek.forEach((day, index) => {
        const cell = sheet.getCell(3, 2 + index);
        cell.value = day;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF6366F1' }
        };
        cell.alignment = { horizontal: 'center' };
    });

    sheet.columns = [
        { width: 10 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
    ];

    // Criar matriz de contagem
    const heatmapData = timeSlots.map(() => new Array(7).fill(0));

    data.followUps.forEach(f => {
        const date = new Date(f.scheduledDate);
        const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const timeIndex = timeSlots.indexOf(time);
        
        if (timeIndex !== -1 && dayIndex >= 0 && dayIndex < 7) {
            heatmapData[timeIndex][dayIndex]++;
        }
    });

    // Encontrar máximo para normalização
    const maxCount = Math.max(...heatmapData.flat());

    // Preencher matriz
    timeSlots.forEach((time, timeIndex) => {
        const row = 4 + timeIndex;
        sheet.getCell(`A${row}`).value = time;
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`A${row}`).alignment = { horizontal: 'center' };

        heatmapData[timeIndex].forEach((count, dayIndex) => {
            const cell = sheet.getCell(row, 2 + dayIndex);
            cell.value = count;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            
            // Gradiente de cores baseado na intensidade
            const intensity = maxCount > 0 ? count / maxCount : 0;
            const red = Math.round(239 + (16 - 239) * intensity);
            const green = Math.round(68 + (185 - 68) * (1 - intensity));
            const blue = Math.round(68 + (129 - 68) * (1 - intensity));
            
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: `FF${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}` }
            };
            
            cell.font = { bold: true, color: { argb: intensity > 0.5 ? 'FFFFFFFF' : 'FF000000' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        sheet.getRow(row).height = 30;
    });

    // Legenda
    const legendRow = 4 + timeSlots.length + 2;
    sheet.mergeCells(`A${legendRow}:H${legendRow}`);
    const legendCell = sheet.getCell(`A${legendRow}`);
    legendCell.value = `Legenda: Cores mais intensas (vermelhas) = mais visitas agendadas | Cores mais claras (verdes) = menos visitas`;
    legendCell.font = { italic: true, size: 10 };
    legendCell.alignment = { horizontal: 'center' };
}

/**
 * ABA 6: Restaurantes Priorizados
 */
async function createPrioritizedRestaurantsSheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('🏆 Top Restaurantes', {
        properties: { tabColor: { argb: 'FFFBBF24' } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
    });

    // Título
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '🏆 TOP RESTAURANTES PRIORIZADOS PARA PROSPECÇÃO';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFBBF24' }
    };
    sheet.getRow(1).height = 30;

    // Headers
    const headers = ['Rank', 'Restaurante', 'Bairro', 'Avaliação', 'Reviews', 'Potencial', 'Proj. Entregas', 'Status', 'Score'];
    sheet.getRow(2).values = headers;
    sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' }
    };
    sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 25;

    sheet.columns = [
        { width: 6 },  // Rank
        { width: 35 }, // Restaurante
        { width: 20 }, // Bairro
        { width: 10 }, // Avaliação
        { width: 10 }, // Reviews
        { width: 15 }, // Potencial
        { width: 15 }, // Proj. Entregas
        { width: 15 }, // Status
        { width: 10 }, // Score
    ];

    // Calcular score e ordenar
    const scoredRestaurants = data.restaurants.map(r => {
        let score = 0;
        
        if (r.salesPotential === 'ALTISSIMO') score += 100;
        else if (r.salesPotential === 'ALTO') score += 75;
        else if (r.salesPotential === 'MEDIO') score += 50;
        else if (r.salesPotential === 'BAIXO') score += 25;
        
        score += r.rating * 10;
        score += Math.min(r.reviewCount, 100) * 0.5;
        score += Math.min(r.projectedDeliveries / 100, 50);
        
        return { restaurant: r, score: Math.round(score) };
    }).sort((a, b) => b.score - a.score);

    // Preencher top restaurantes
    scoredRestaurants.forEach((item, index) => {
        const row = index + 3;
        const r = item.restaurant;
        
        sheet.getCell(`A${row}`).value = index + 1;
        sheet.getCell(`B${row}`).value = r.name;
        sheet.getCell(`C${row}`).value = r.address?.neighborhood || 'N/A';
        sheet.getCell(`D${row}`).value = r.rating ? r.rating.toFixed(1) : 'N/D';
        sheet.getCell(`E${row}`).value = r.reviewCount;
        sheet.getCell(`F${row}`).value = r.salesPotential || 'N/A';
        sheet.getCell(`G${row}`).value = r.projectedDeliveries;
        sheet.getCell(`H${row}`).value = r.status;
        sheet.getCell(`I${row}`).value = item.score;

        // Formatação
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            const cell = sheet.getCell(`${col}${row}`);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: fillColor }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
            cell.alignment = { vertical: 'middle' };
        });

        // Destacar top 3
        if (index < 3) {
            const medal = ['🥇', '🥈', '🥉'][index];
            sheet.getCell(`A${row}`).value = medal;
            sheet.getCell(`A${row}`).font = { size: 16 };
        }

        // Colorir potencial
        const potentialCell = sheet.getCell(`F${row}`);
        let color = 'FFF3F4F6';
        if (r.salesPotential === 'ALTISSIMO') color = 'FFEF4444';
        else if (r.salesPotential === 'ALTO') color = 'FFFBBF24';
        else if (r.salesPotential === 'MEDIO') color = 'FF3B82F6';
        
        potentialCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
        };
        potentialCell.font = { bold: true };

        sheet.getRow(row).height = 25;
    });

    // Auto-filter
    sheet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: scoredRestaurants.length + 2, column: 9 }
    };
}

/**
 * ABA 7: Resumo Executivo
 */
async function createExecutiveSummarySheet(workbook: ExcelJS.Workbook, data: WeeklyScheduleData) {
    const sheet = workbook.addWorksheet('📄 Resumo Executivo', {
        properties: { tabColor: { argb: 'FF3B82F6' } },
    });

    sheet.columns = [
        { width: 3 },
        { width: 50 },
        { width: 30 },
        { width: 3 },
    ];

    // Título
    sheet.mergeCells('B2:C2');
    const titleCell = sheet.getCell('B2');
    titleCell.value = '📄 RESUMO EXECUTIVO DA AGENDA SEMANAL';
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
    };
    sheet.getRow(2).height = 40;

    let currentRow = 4;

    // Informações gerais
    const weekEnd = new Date(data.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const summaryData = [
        ['👤 Vendedor', data.seller.name],
        ['📧 Email', data.seller.email || 'Não informado'],
        ['📍 Regiões', data.seller.regions.join(', ') || 'Não definido'],
        ['🏘️ Bairros', data.seller.neighborhoods.join(', ') || 'Não definido'],
        ['📅 Período', `${data.weekStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')}`],
        ['📊 Total de Visitas', data.followUps.length],
        ['🏪 Restaurantes na Carteira', data.restaurants.length],
        ['⭐ Avaliação Média dos Restaurantes', (data.restaurants.reduce((sum, r) => sum + r.rating, 0) / data.restaurants.length).toFixed(1)],
        ['💰 Projeção Total de Entregas', data.restaurants.reduce((sum, r) => sum + r.projectedDeliveries, 0)],
        ['🎯 Taxa de Ocupação da Agenda', `${((data.followUps.length / 40) * 100).toFixed(1)}%`],
    ];

    summaryData.forEach(([label, value]) => {
        sheet.getCell(`B${currentRow}`).value = label;
        sheet.getCell(`C${currentRow}`).value = value;
        
        sheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 };
        sheet.getCell(`C${currentRow}`).font = { size: 12 };
        
        ['B', 'C'].forEach(col => {
            const cell = sheet.getCell(`${col}${currentRow}`);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: currentRow % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
            cell.alignment = { vertical: 'middle' };
        });
        
        sheet.getRow(currentRow).height = 25;
        currentRow++;
    });

    // Insights e recomendações
    currentRow += 2;
    sheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const insightsTitle = sheet.getCell(`B${currentRow}`);
    insightsTitle.value = '💡 INSIGHTS E RECOMENDAÇÕES';
    insightsTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    insightsTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' }
    };
    insightsTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(currentRow).height = 30;

    currentRow++;
    const totalVisits = data.followUps.length;
    const highPotential = data.followUps.filter(f => 
        f.restaurant.salesPotential === 'ALTISSIMO' || f.restaurant.salesPotential === 'ALTO'
    ).length;

    const insights = [
        `✅ Agenda ${totalVisits > 30 ? 'bem preenchida' : 'com espaço para otimização'} com ${totalVisits} visitas agendadas.`,
        `🎯 ${highPotential} visitas (${((highPotential / totalVisits) * 100).toFixed(1)}%) são de alto/altíssimo potencial.`,
        `📊 Priorize os restaurantes com maior score para maximizar resultados.`,
        `⏰ Mantenha 15min de buffer entre visitas para deslocamento.`,
        `📱 Confirme as visitas 1 dia antes para evitar cancelamentos.`,
        `💼 Prepare material comercial específico para cada potencial de venda.`,
    ];

    insights.forEach(insight => {
        sheet.mergeCells(`B${currentRow}:C${currentRow}`);
        const cell = sheet.getCell(`B${currentRow}`);
        cell.value = insight;
        cell.font = { size: 11 };
        cell.alignment = { wrapText: true, vertical: 'middle' };
        sheet.getRow(currentRow).height = 30;
        currentRow++;
    });

    // Rodapé
    currentRow += 2;
    sheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const footerCell = sheet.getCell(`B${currentRow}`);
    footerCell.value = `Documento gerado automaticamente por CRM Ymbale em ${new Date().toLocaleString('pt-BR')}`;
    footerCell.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
    footerCell.alignment = { horizontal: 'center' };
}

