import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService payment verification', () => {
  const pendingOrder = {
    id: 21,
    buyerId: 7,
    status: 'pending',
    paymentMethod: 'paypal',
    totalAmount: 12.5,
    currency: 'INR',
    providerOrderId: 'provider-order-21',
    couponAmount: null,
    offerAmount: null,
    couponCode: null,
    offerId: null,
    items: [],
  };

  function build(order = pendingOrder) {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        findUnique: jest.fn().mockResolvedValue(order),
      },
    };
    const paypal = { captureOrder: jest.fn() };
    const razorpay = { verifyPayment: jest.fn() };
    const service = new OrdersService(
      prisma as never,
      {} as never,
      paypal as never,
      razorpay as never,
      {} as never,
      {} as never,
    );
    return { service, prisma, paypal, razorpay };
  }

  it('only captures the PayPal order persisted for this local checkout', async () => {
    const { service, paypal } = build();
    paypal.captureOrder.mockResolvedValue({
      captureId: 'capture-21',
      referenceId: '21',
      amount: '12.50',
      currency: 'INR',
    });
    const fulfill = jest.spyOn(service, 'fulfill').mockResolvedValue(undefined);

    await expect(service.capturePaypal(7, 21, 'provider-order-21')).resolves.toEqual({ ok: true });
    expect(paypal.captureOrder).toHaveBeenCalledWith('provider-order-21');
    expect(fulfill).toHaveBeenCalledWith(21, 'capture-21');
  });

  it('rejects PayPal orders not created for this checkout', async () => {
    const { service, paypal } = build();

    await expect(service.capturePaypal(7, 21, 'other-provider-order')).rejects.toThrow(BadRequestException);
    expect(paypal.captureOrder).not.toHaveBeenCalled();
  });

  it('rejects PayPal captures whose amount, currency, or reference differs', async () => {
    const { service, paypal } = build();
    paypal.captureOrder.mockResolvedValue({
      captureId: 'capture-21',
      referenceId: '21',
      amount: '1.00',
      currency: 'INR',
    });

    await expect(service.capturePaypal(7, 21, 'provider-order-21')).rejects.toThrow(BadRequestException);
  });

  it('binds Razorpay verification to the stored provider order and local price', async () => {
    const razorpayOrder = { ...pendingOrder, paymentMethod: 'razorpay' };
    const { service, razorpay } = build(razorpayOrder);
    razorpay.verifyPayment.mockResolvedValue(true);
    const fulfill = jest.spyOn(service, 'fulfill').mockResolvedValue(undefined);

    await expect(service.verifyRazorpay(7, 21, {
      razorpayOrderId: 'provider-order-21',
      razorpayPaymentId: 'payment-21',
      signature: 'signature',
    })).resolves.toEqual({ ok: true });

    expect(razorpay.verifyPayment).toHaveBeenCalledWith({
      razorpayOrderId: 'provider-order-21',
      razorpayPaymentId: 'payment-21',
      signature: 'signature',
      expectedOrderId: 'provider-order-21',
      expectedAmountMinor: 1250,
      expectedCurrency: 'INR',
    });
    expect(fulfill).toHaveBeenCalledWith(21, 'payment-21');
  });
});

describe('OrdersService fulfillment concurrency', () => {
  it('claims a pending order once before issuing wallet credits', async () => {
    const order = {
      id: 5,
      buyerId: 7,
      status: 'pending',
      totalAmount: 100,
      couponAmount: null,
      offerAmount: null,
      couponCode: null,
      offerId: null,
      items: [{ courseId: 3, price: 100, commissionRate: 20 }],
    };
    let status = 'pending';
    const tx = {
      order: {
        updateMany: jest.fn(async () => {
          if (status !== 'pending') return { count: 0 };
          status = 'approved';
          return { count: 1 };
        }),
      },
      course: { findMany: jest.fn().mockResolvedValue([{ id: 3, instructorId: 9 }]) },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      cart: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (transaction: typeof tx) => Promise<boolean>) => callback(tx)),
    };
    const service = new OrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { recordRedemption: jest.fn() } as never,
      {} as never,
    );

    await Promise.all([
      service.fulfill(5, 'payment-a'),
      service.fulfill(5, 'payment-b'),
    ]);

    expect(tx.order.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.enrollment.create).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { wallet: { increment: 80 } },
    });
  });
});
