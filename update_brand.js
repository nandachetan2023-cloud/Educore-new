const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function update() {
  const updates = {
    'logo': '/brand/logo.svg',
    'name': 'EduCore',
    'primaryColor': '#4f46e5',
    'secondaryColor': '#0ea5e9',
    'currency': 'USD',
    'commissionRate': '20',
  };
  for (const [key, value] of Object.entries(updates)) {
    const fullKey = 'brand.' + key;
    const existing = await p.setting.findFirst({ where: { tenantId: null, key: fullKey } });
    if (existing) {
      await p.setting.update({ where: { id: existing.id }, data: { value } });
      console.log('updated ' + fullKey + ' = ' + value);
    } else {
      await p.setting.create({ data: { tenantId: null, key: fullKey, value } });
      console.log('created ' + fullKey + ' = ' + value);
    }
  }
}
update().finally(() => p.$disconnect());
