// Helper function para buscar valores de colunas com múltiplas variações
export function getColumnValue(row: any, possibleNames: string[]): any {
    // Primeiro, tentar busca exata
    for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name];
        }
    }
    
    // Depois, tentar busca case-insensitive e com trim
    const rowKeys = Object.keys(row);
    for (const possibleName of possibleNames) {
        const found = rowKeys.find(key => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
            const normalizedName = possibleName.toLowerCase().trim().replace(/\s+/g, ' ');
            return normalizedKey === normalizedName || 
                   normalizedKey.includes(normalizedName) || 
                   normalizedName.includes(normalizedKey);
        });
        if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
            return row[found];
        }
    }
    
    return null;
}

// Função para mapear todos os campos do restaurante
export function mapRestaurantFields(row: any, comments: string[]) {
    const name = getColumnValue(row, ['Nome', 'nome', 'NOME', 'Restaurante', 'restaurante']) || 'Unknown';
    const city = getColumnValue(row, ['Cidade', 'cidade', 'CIDADE', 'City', 'city']) || '';
    
    // Avaliação (rating)
    const ratingValue = getColumnValue(row, [
        'Avaliação', 'AvaliaÃ§Ã£o', 'avaliação', 'AVALIAÇÃO',
        'Nota', 'nota', 'NOTA', 'Rating', 'rating', 'RATING',
        'Avaliação Média', 'Avaliação média', 'Nota Média'
    ]);
    const rating = ratingValue ? parseFloat(String(ratingValue).replace(',', '.')) : 0;
    
    // Número de Avaliações (reviewCount)
    const reviewCountValue = getColumnValue(row, [
        'Nº Avaliações', 'NÂº AvaliaÃ§Ãµes', 'Nº Avaliações', 'N° Avaliações',
        'nº avaliações', 'NÚMERO DE AVALIAÇÕES', 'Total Avaliações',
        'Total de Avaliações', 'Quantidade de Avaliações', 'Qtd Avaliações',
        'Review Count', 'reviewCount', 'Reviews', 'Número de Avaliações'
    ]);
    const reviewCount = reviewCountValue ? parseInt(String(reviewCountValue).replace(/[^\d]/g, '')) : 0;
    
    // Total de Comentários
    const totalCommentsValue = getColumnValue(row, [
        'Total Comentários', 'Total ComentÃ¡rios', 'total comentários',
        'TOTAL COMENTÁRIOS', 'Total de Comentários', 'Qtd Comentários',
        'Quantidade de Comentários', 'Nº Comentários', 'N° Comentários',
        'Número de Comentários'
    ]);
    const totalComments = totalCommentsValue ? parseInt(String(totalCommentsValue).replace(/[^\d]/g, '')) : comments.length;
    
    // Projeção de Entregas
    const projectedDeliveriesValue = getColumnValue(row, [
        'Projeção Entregas/Mês', 'ProjeÃ§Ã£o Entregas/MÃªs',
        'Projeção Entregas/Mês', 'Projeção Entregas por Mês',
        'Projeção de Entregas', 'Entregas/Mês', 'Entregas por Mês',
        'Projected Deliveries', 'projectedDeliveries', 'Projeção Mensal'
    ]);
    const projectedDeliveries = projectedDeliveriesValue ? parseInt(String(projectedDeliveriesValue).replace(/[^\d]/g, '')) : 0;
    
    // Potencial de Vendas
    const salesPotential = getColumnValue(row, [
        'Potencial Vendas', 'potencial vendas', 'POTENCIAL VENDAS',
        'Potencial', 'potencial', 'POTENCIAL', 'Sales Potential',
        'Potencial de Vendas'
    ]) || 'N/A';
    
    // Endereço
    const street = getColumnValue(row, [
        'Endereço (Rua)', 'EndereÃ§o (Rua)', 'endereço (rua)',
        'Rua', 'rua', 'RUA', 'Endereço', 'endereço', 'ENDEREÇO',
        'Street', 'street', 'Logradouro'
    ]) || '';
    
    const neighborhood = getColumnValue(row, [
        'Bairro', 'bairro', 'BAIRRO', 'Neighborhood', 'neighborhood',
        'Bairro/Distrito', 'Distrito', 'distrito'
    ]) || '';
    
    const state = getColumnValue(row, [
        'Estado', 'estado', 'ESTADO', 'State', 'state',
        'UF', 'uf', 'UF/Estado'
    ]) || '';
    
    const zip = getColumnValue(row, [
        'CEP', 'cep', 'CEP/Código Postal', 'Código Postal',
        'Zip Code', 'zipCode', 'Postal Code'
    ]) || '';
    
    // Data de Coleta
    const lastCollectionDateValue = getColumnValue(row, [
        'Data Coleta', 'data coleta', 'DATA COLETA',
        'Data de Coleta', 'Data da Coleta', 'Collection Date',
        'Última Coleta', 'Data Última Coleta'
    ]);
    const lastCollectionDate = lastCollectionDateValue 
        ? (lastCollectionDateValue instanceof Date 
            ? lastCollectionDateValue 
            : new Date(String(lastCollectionDateValue)))
        : null;

    return {
        name,
        city,
        rating,
        reviewCount,
        totalComments,
        projectedDeliveries,
        salesPotential: String(salesPotential),
        address: {
            street: String(street),
            neighborhood: String(neighborhood),
            city: city,
            state: String(state),
            zip: String(zip),
        },
        lastCollectionDate,
        status: String(salesPotential).toUpperCase() === 'ALTÍSSIMO' || 
                String(salesPotential).toUpperCase() === 'ALTÃSSIMO' || 
                String(salesPotential).toUpperCase().includes('ALTISSIMO')
                ? 'Qualificado' 
                : 'A Analisar'
    };
}

