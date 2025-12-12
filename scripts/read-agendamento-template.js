/**
 * Script para ler e analisar o template de agendamento
 * Execute: node scripts/read-agendamento-template.js
 */

const ExcelJS = require('exceljs');
const path = require('path');

async function readTemplate() {
    const templatePath = path.join(__dirname, '..', 'template_agendamento.xlsx');
    
    console.log('📄 Lendo template:', templatePath);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    console.log(`\n📊 Total de planilhas: ${workbook.worksheets.length}`);
    
    workbook.worksheets.forEach((worksheet, index) => {
        console.log(`\n📋 Planilha ${index + 1}: "${worksheet.name}"`);
        console.log(`   Total de linhas: ${worksheet.rowCount}`);
        console.log(`   Total de colunas: ${worksheet.columnCount}`);
        
        // Ler primeiras 10 linhas
        console.log('\n   Primeiras 10 linhas:');
        for (let row = 1; row <= Math.min(10, worksheet.rowCount); row++) {
            const rowData = worksheet.getRow(row);
            const values = [];
            rowData.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= 20) { // Limitar a 20 colunas
                    values.push(`[${colNumber}]: "${cell.value || ''}"`);
                }
            });
            if (values.length > 0) {
                console.log(`   Linha ${row}: ${values.join(', ')}`);
            }
        }
    });
}

readTemplate()
    .then(() => {
        console.log('\n✅ Análise concluída!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });

