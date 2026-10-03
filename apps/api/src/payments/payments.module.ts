import { Body, Controller, Get, Module, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';
import { RazorpayConfig, RazorpayService } from './razorpay.service';

class RazorpaySettingsDto {
  @IsOptional() @IsString() keyId?: string;
  @IsOptional() @IsString() keySecret?: string;
}

@ApiTags('payment-settings')
@Controller('admin/payment-settings')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class PaymentSettingsController {
  constructor(private razorpay: RazorpayService) {}

  private redact(cfg: RazorpayConfig) {
    return {
      keyId: cfg.keyId,
      keySecret: cfg.keySecret ? '••••••••' : '',
      enabled: cfg.enabled,
    };
  }

  @Get()
  async get() {
    return this.redact(await this.razorpay.getConfig());
  }

  @Put()
  async update(@Body() dto: RazorpaySettingsDto) {
    return this.redact(await this.razorpay.setConfig(dto));
  }

  @Post('razorpay/test')
  async testRazorpay(@CurrentUser('email') email: string) {
    const res = await this.razorpay.testConnection();
    return { ...res, testedBy: email };
  }
}

@Module({
  providers: [RazorpayService],
  controllers: [PaymentSettingsController],
  exports: [RazorpayService],
})
export class PaymentsModule {}