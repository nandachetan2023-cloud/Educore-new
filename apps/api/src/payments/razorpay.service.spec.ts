import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
  const ENV = { keyId: 'rzp_test_env', keySecret: 'envsecret' };
  type Row = { id: number; key: string; value: string };
  let nextId = 1;

  function build(rows: Array<{ key: string; value: string }>) {
    const stored: Row[] = rows.map((r) => ({ id: nextId++, ...r }));
    const prisma = {
      setting: {
        findMany: jest.fn().mockResolvedValue(stored),
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(stored.find((r) => r.key === where.key) ?? null),
        ),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = { id: nextId++, ...data };
          stored.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const row = stored.find((r) => r.id === where.id);
          if (row) row.value = data.value;
          return Promise.resolve(row ?? data);
        }),
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          const i = stored.findIndex((r) => r.key === where.key);
          if (i >= 0) stored.splice(i, 1);
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const nested = { razorpay: { keyId: ENV.keyId, keySecret: ENV.keySecret } };
    const config = {
      get: jest.fn((path: string) =>
        path
          .split('.')
          .reduce<unknown>(
            (acc, part) =>
              acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
            nested,
          ),
      ),
    };
    return { service: new RazorpayService(config as never, prisma as never), prisma, stored };
  }

  describe('getConfig', () => {
    it('falls back to .env when nothing is stored', async () => {
      const { service } = build([]);
      await expect(service.getConfig()).resolves.toEqual({
        keyId: 'rzp_test_env',
        keySecret: 'envsecret',
        enabled: true,
      });
    });

    it('lets stored values override .env', async () => {
      const { service } = build([
        { key: 'razorpay.keyId', value: 'rzp_test_stored' },
        { key: 'razorpay.keySecret', value: 'storedsecret' },
      ]);
      await expect(service.getConfig()).resolves.toEqual({
        keyId: 'rzp_test_stored',
        keySecret: 'storedsecret',
        enabled: true,
      });
    });

    it('mixes a stored key with the .env secret', async () => {
      const { service } = build([{ key: 'razorpay.keyId', value: 'rzp_test_stored' }]);
      await expect(service.getConfig()).resolves.toEqual({
        keyId: 'rzp_test_stored',
        keySecret: 'envsecret',
        enabled: true,
      });
    });

    it('reports disabled when no credentials exist anywhere', async () => {
      const prisma = { setting: { findMany: jest.fn().mockResolvedValue([]) } };
      const config = { get: jest.fn().mockReturnValue(undefined) };
      const service = new RazorpayService(config as never, prisma as never);
      await expect(service.getConfig()).resolves.toEqual({
        keyId: '',
        keySecret: '',
        enabled: false,
      });
    });
  });

  describe('setConfig', () => {
    it('persists keys under the razorpay. prefix', async () => {
      const { service, prisma } = build([]);
      await service.setConfig({ keyId: 'rzp_test_new', keySecret: 'newsecret' });
      expect(prisma.setting.create).toHaveBeenCalledWith({
        data: { key: 'razorpay.keyId', value: 'rzp_test_new' },
      });
      expect(prisma.setting.create).toHaveBeenCalledWith({
        data: { key: 'razorpay.keySecret', value: 'newsecret' },
      });
    });

    it('clears the override when an empty string is sent', async () => {
      const rows = [
        { key: 'razorpay.keyId', value: 'rzp_test_stored' },
        { key: 'razorpay.keySecret', value: 'storedsecret' },
      ];
      const { service, stored } = build(rows);
      const cfg = await service.setConfig({ keyId: '', keySecret: '' });
      expect(stored).toEqual([]);
      expect(cfg).toEqual({ keyId: 'rzp_test_env', keySecret: 'envsecret', enabled: true });
    });
  });

  describe('verifySignature', () => {
    const payload = { razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1' };

    it('accepts the signature Razorpay generates with the configured secret', async () => {
      const { createHmac } = await import('crypto');
      const signature = createHmac('sha256', 'storedsecret')
        .update('order_1|pay_1')
        .digest('hex');
      const { service } = build([
        { key: 'razorpay.keyId', value: 'rzp_test_stored' },
        { key: 'razorpay.keySecret', value: 'storedsecret' },
      ]);
      await expect(service.verifySignature({ ...payload, signature })).resolves.toBe(true);
    });

    it('rejects a tampered amount/signature', async () => {
      const { service } = build([
        { key: 'razorpay.keySecret', value: 'storedsecret' },
      ]);
      await expect(
        service.verifySignature({ ...payload, signature: 'f'.repeat(64) }),
      ).resolves.toBe(false);
    });

    it('rejects a signature of the wrong length without throwing', async () => {
      const { service } = build([{ key: 'razorpay.keySecret', value: 'storedsecret' }]);
      await expect(service.verifySignature({ ...payload, signature: 'short' })).resolves.toBe(false);
    });

    it('rejects everything when Razorpay is not configured', async () => {
      const prisma = { setting: { findMany: jest.fn().mockResolvedValue([]) } };
      const config = { get: jest.fn().mockReturnValue(undefined) };
      const service = new RazorpayService(config as never, prisma as never);
      await expect(
        service.verifySignature({ ...payload, signature: 'a'.repeat(64) }),
      ).resolves.toBe(false);
    });
  });
});