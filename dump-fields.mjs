import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function listFields() {
    const pdfBytes = fs.readFileSync('public/templates/Monthly-Form-Jan.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    fields.forEach(field => {
        const type = field.constructor.name;
        const name = field.getName();
        console.log(`Field: ${name}, Type: ${type}`);
    });
}

listFields().catch(console.error);
