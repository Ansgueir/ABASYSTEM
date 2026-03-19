import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

async function checkFields() {
    const templatePath = path.join(process.cwd(), "public", "templates", "Fieldwork-Verification-Form.pdf");
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    fields.forEach(f => {
        console.log(`Field Name: ${f.getName()}`);
    });
}

checkFields();
