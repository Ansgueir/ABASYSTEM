const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeExcel() {
    const filePath = 'c:\\Users\\Andyf\\OneDrive\\Documentos\\ERP PRACTICANTES\\CARGA_MASIVA_MAESTRA_20260423.xlsx';
    const workbook = new ExcelJS.Workbook();
    
    try {
        await workbook.xlsx.readFile(filePath);
        console.log('--- EXCEL AUDIT REPORT ---');
        console.log('Total Sheets:', workbook.worksheets.length);
        
        workbook.worksheets.forEach(sheet => {
            console.log(`\nSheet: "${sheet.name}"`);
            console.log('Rows:', sheet.rowCount);
            
            const firstRow = sheet.getRow(1);
            const headers = [];
            firstRow.eachCell(cell => {
                headers.push(cell.value);
            });
            console.log('Headers:', headers.join(' | '));
            
            if (sheet.rowCount > 1) {
                console.log('Sample Data (Row 2):');
                const secondRow = sheet.getRow(2);
                const sample = [];
                secondRow.eachCell(cell => {
                    sample.push(cell.value);
                });
                console.log(sample.join(' | '));
            }
        });
    } catch (error) {
        console.error('Error reading Excel:', error);
    }
}

analyzeExcel();
