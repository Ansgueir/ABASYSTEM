const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function main() {
  const p = path.join(__dirname, 'mapeo_db_importacionsinpay.xlsx');
  const wb = xlsx.readFile(p);
  
  const supSheet = wb.Sheets['Supervisor'];
  const stuSheet = wb.Sheets['Student'];
  
  const rawSups = xlsx.utils.sheet_to_json(supSheet, { header: 1 });
  const rawStus = xlsx.utils.sheet_to_json(stuSheet, { header: 1 });
  
  const supHeaders = rawSups[0];
  const stuHeaders = rawStus[0];
  
  // Row 0 is headers, Row 1 is metadata, Row 2+ is data
  const sups = rawSups.slice(2).map(row => {
    const obj = {};
    supHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(s => s.fullName);
  
  const stus = rawStus.slice(2).map(row => {
    const obj = {};
    stuHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(s => s.fullName);

  console.log(`Found ${sups.length} Supervisors and ${stus.length} Students to import.`);
  
  const defaultPasswordHash = await bcrypt.hash('aba1234#', 10);
  
  const supervisorIdMap = new Map(); // Name -> Supervisor ID
  
  for (const s of sups) {
    const email = s.email || (s.fullName.replace(/\s+/g, '').toLowerCase() + '@aba.com');
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: s.fullName,
          email,
          passwordHash: defaultPasswordHash,
          role: 'SUPERVISOR'
        }
      });
      console.log(`Created User for Supervisor: ${s.fullName}`);
    }
    
    let sup = await prisma.supervisor.findFirst({ where: { userId: user.id } });
    if (!sup) {
      sup = await prisma.supervisor.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          fullName: s.fullName,
          email: user.email,
          phone: String(s.phone || ''),
          status: s.status || 'ACTIVE',
          bacbId: String(s.bacbId || ''),
          certificantNumber: String(s.certificantNumber || ''),
          credentialType: s.credentialType || 'BCBA'
        }
      });
      console.log(`Created Supervisor Profile: ${s.fullName}`);
    }
    
    const cleanName = s.fullName.toLowerCase().replace(/[,.\s]/g, '');
    supervisorIdMap.set(cleanName, sup.id);
  }
  
  for (const s of stus) {
    const email = s.email || (s.fullName.replace(/\s+/g, '').toLowerCase() + '@aba.com');
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: s.fullName,
          email,
          passwordHash: defaultPasswordHash,
          role: 'STUDENT'
        }
      });
      console.log(`Created User for Student: ${s.fullName}`);
    }
    
    let supId = null;
    if (s.supervisorId && typeof s.supervisorId === 'string') {
        const cleanReqName = s.supervisorId.toLowerCase().replace(/[,.\s]/g, '');
        supId = supervisorIdMap.get(cleanReqName);
        if (!supId) {
            const possible = [...supervisorIdMap.keys()].find(k => k.includes(cleanReqName) || cleanReqName.includes(k));
            if (possible) supId = supervisorIdMap.get(possible);
        }
    }
    
    let stu = await prisma.student.findFirst({ where: { userId: user.id } });
    if (!stu) {
      await prisma.student.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          supervisorId: supId,
          fullName: s.fullName,
          email: user.email,
          status: s.status || 'ACTIVE',
          phone: String(s.phone || ''),
          bacbId: String(s.bacbId || '').substring(0,10),
          supervisionType: s.supervisionType || 'CONCENTRATED',
          fieldworkType: s.fieldworkType || 'MULTIPLE_SUPERVISORS',
          amountToPay: s.amountToPay ? Number(s.amountToPay) : 0,
          supervisionPercentage: s.supervisionPercentage ? Number(s.supervisionPercentage) : 0,
          hoursToDo: s.hoursToDo ? Number(s.hoursToDo) : 0,
          level: s.level || 'MASTER',
          school: s.school || 'N/A'
        }
      });
      console.log(`Created Student Profile: ${s.fullName} ${supId ? '(Linked to Supervisor)' : '(No Supervisor)'}`);
    } else {
      if (supId) {
        await prisma.student.update({
          where: { id: stu.id },
          data: { supervisorId: supId }
        });
        console.log(`Updated Student Profile: ${s.fullName} (Linked to Supervisor)`);
      }
    }
  }
  
  console.log('IMPORT COMPLETE.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
