const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function listFields() {
    const templatePath = 'c:/Users/Andyf/OneDrive/Documentos/ERP PRACTICANTES/aba-supervision-system/public/templates/Fieldwork-Verification-Form.pdf';
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log('--- START FIELD LIST ---');
    fields.forEach(f => {
        try {
            console.log(`- ${f.getName()} [${f.constructor.name}]`);
        } catch (e) {}
    });
    console.log('--- END FIELD LIST ---');
}

listFields();
