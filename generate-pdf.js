const { chromium } = require('playwright');
const path = require('path');

async function generatePDF() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = 'file://' + path.join(__dirname, 'audit_report.html').replace(/\\/g, '/');
  
  console.log('Opening file:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: 'Audit_Report_ABA_System.pdf',
    format: 'A4',
    margin: {
      top: '40px',
      right: '40px',
      bottom: '40px',
      left: '40px'
    },
    printBackground: true
  });

  await browser.close();
  console.log('PDF generado exitosamente como Audit_Report_ABA_System.pdf');
}

generatePDF().catch(console.error);
