const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.setting.findMany({ where: { key: { startsWith: 'brand.' } } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.$disconnect());
