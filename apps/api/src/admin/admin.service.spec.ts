import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.module';
import { AdminService } from './admin.service';

describe('AdminService team invitations', () => {
  let service: AdminService;
  let prisma: {
    user: { findFirst: jest.Mock };
    admin: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let mail: {
    prepareInvitation: jest.Mock;
    queueInvitation: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      admin: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback) => callback({
        user: { create: jest.fn().mockResolvedValue({
          id: 12,
          name: 'New teammate',
          email: 'person@example.com',
          role: 'student',
        }) },
      })),
    };
    mail = {
      prepareInvitation: jest.fn().mockResolvedValue({
        to: 'person@example.com',
        subject: 'Invitation',
        html: '<p>Welcome</p>',
      }),
      queueInvitation: jest.fn().mockResolvedValue({ id: 7 }),
    };
    service = new AdminService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
    );
  });

  it('creates the account and queues a temporary-password invitation in one transaction', async () => {
    await expect(service.inviteUser({
      name: 'New teammate',
      email: 'Person@Example.com',
      role: 'student',
    })).resolves.toMatchObject({
      id: 12,
      invitationEmailQueued: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mail.prepareInvitation).toHaveBeenCalledWith(expect.objectContaining({
      to: 'person@example.com',
      name: 'New teammate',
      role: 'student',
      password: expect.any(String),
    }));
    expect(mail.queueInvitation).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      to: 'person@example.com',
      subject: 'Invitation',
    }));
  });

  it('does not create an account when SMTP is not configured', async () => {
    mail.prepareInvitation.mockRejectedValue(new ServiceUnavailableException('SMTP is not configured'));

    await expect(service.inviteUser({
      name: 'New teammate',
      email: 'person@example.com',
      role: 'student',
    })).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
