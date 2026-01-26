
import ExcelJS from 'exceljs';
import path from 'path';

const filePath = path.join(process.cwd(), 'Planilhas', 'Template Agendamento CheckMob - Jan.26.xlsx');

async function analyze() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        console.log(`Sheet Name: ${worksheet.name}`);

        // Get headers from first row
        const headers = [];
        const row = worksheet.getRow(1);
        row.eachCell((cell, colNumber) => {
            headers.push({ col: colNumber, value: cell.value });
        });

        console.log('Headers:', JSON.stringify(headers, null, 2));

        // Get a sample data row (row 2) to see content type
        const sampleRow = worksheet.getRow(2);
        const sampleData = [];
        sampleRow.eachCell((cell, colNumber) => {
            sampleData.push({ col: colNumber, value: cell.value });
        });
        console.log('Sample Row 2:', JSON.stringify(sampleData, null, 2));

    } catch (error) {
        console.error('Error reading file:', error);
    }
}

analyze();
