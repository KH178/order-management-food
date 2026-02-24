const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const rows = await prisma.outbox.findMany();
    console.log('Total outbox rows in DB:', rows.length);
    const unpublished = rows.filter(r => !r.published);
    console.log('Unpublished (stuck) rows remaining:', unpublished.length);
  } catch (err) {
    console.error("PRISMA ERROR:");
    console.error(err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}
check();
