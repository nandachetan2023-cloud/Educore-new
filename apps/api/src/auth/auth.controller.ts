import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, ChangeEmailDto, TwoFactorCodeDto, TwoFactorVerifyDto, VerifyEmailDto } from './dto';
import { Public, CurrentUser, AuthPrincipal } from '../common/decorators';
import { Principal } from '../common/enums';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    // Front-office login: resolves to student or instructor by their role.
    return this.auth.loginFrontend(dto);
  }

  @Public()
  @Post('admin/login')
  adminLogin(@Body() dto: LoginDto) {
    return this.auth.login(dto, Principal.ADMIN);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email, dto.role);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  /** Confirms an email address from the link sent on signup. */
  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  /** Re-sends the verification link to the signed-in account. */
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthPrincipal) {
    return this.auth.resendVerification(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user);
  }

  /** Change your own password (students, instructors and admins). */
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthPrincipal, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  /** Change the email address on your own account. */
  @Post('change-email')
  changeEmail(@CurrentUser() user: AuthPrincipal, @Body() dto: ChangeEmailDto) {
    return this.auth.changeEmail(user, dto.currentPassword, dto.newEmail);
  }

  /** Begin 2FA setup: returns a secret and otpauth URL for an authenticator app. */
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthPrincipal) {
    return this.auth.setupTwoFactor(user);
  }

  /** Confirm setup by verifying the first code; enables 2FA. */
  @Post('2fa/enable')
  enableTwoFactor(@CurrentUser() user: AuthPrincipal, @Body() dto: TwoFactorCodeDto) {
    return this.auth.enableTwoFactor(user, dto.code);
  }

  /** Disable 2FA after verifying a current code. */
  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser() user: AuthPrincipal, @Body() dto: TwoFactorCodeDto) {
    return this.auth.disableTwoFactor(user, dto.code);
  }

  /** Complete a login that requires 2FA. */
  @Public()
  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.auth.verifyTwoFactor(dto.challengeToken, dto.code);
  }
}
