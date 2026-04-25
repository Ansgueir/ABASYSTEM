const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeExcel() {
    const filePath = 'c:\\Users\\Andyf\\OneDrive\\Documentos\\ERP PRACTICANTES\\CARGA_MASIVA_MAESTRA_20260423.xlsx';
    const workbook = new ExcelJS.Workbook();
    
    try {
        await workbook.xlsx.readFile(filePath);
        console.log('--- EXCEL STRUCTURE AUDIT ---');
        
        workbook.worksheets.forEach(sheet => {
            console.log(`\n[SHEET] ${sheet.name} (${sheet.rowCount} rows)`);
            const firstRow = sheet.getRow(1);
            const headers = [];
            firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                headers.push(`${colNumber}: ${cell.value}`);
            });
            console.log('HEADERS:', headers.join(' | '));
        });
    } catch (error) {
        console.error('Error reading Excel:', error);
    }
}

analyzeExcel();
