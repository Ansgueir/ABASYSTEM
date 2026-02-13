const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('password123', 10);

    // First check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { email: 'maria@example.com' }
    });

    if (existingUser) {
        console.log('User already exists, updating password...');
        await prisma.user.update({
            where: { email: 'maria@example.com' },
            data: { passwordHash: hash }
        });
        console.log('Password updated for:', existingUser.email);
        return;
    }

    // Create new user with all required student fields
    const user = await prisma.user.create({
        data: {
            email: 'maria@example.com',
            passwordHash: hash,
            role: 'STUDENT',
            student: {
                create: {
                    fullName: 'Maria Rodriguez',
                    paymentAlias: ['Maria R'],
                    bacbId: '12345678',
                    credential: 'RBT',
                    school: 'University of Florida',
                    level: 'BCaBA',
                    phone: '555-0100',
                    email: 'maria@example.com',
                    city: 'Miami',
                    state: 'FL',
                    startDate: new Date(),
                    supervisionType: 'CONCENTRATED',
                    supervisionPercentage: 0.10,
                    hoursToDo: 1500,
                    hoursToPay: 150,
                    amountToPay: 2250.00,
                    hoursPerMonth: 130,
                    totalMonths: 12,
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: 'ACTIVE',
                    availableDaysGroup: ['Monday', 'Wednesday', 'Friday', 'Saturday']
                }
            }
        }
    });
    console.log('User created:', user.email);
}

main()
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
