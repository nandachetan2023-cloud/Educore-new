import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;

  @IsString()
  termsAccepted?: string;

  @IsIn(['student', 'instructor'])
  role!: 'student' | 'instructor';
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** Keep the session for 30 days instead of ending it with the browser session. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  /** Defaults to a front-office (student/instructor) account. */
  @IsOptional()
  @IsString()
  @IsIn(['user','admin'])
  role?: 'user' | 'admin';
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangeEmailDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsEmail()
  newEmail!: string;
}


export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/**
 * SAML SSO configuration for the current tenant. The metadata URL is the
 * preferred input — the API fetches it and derives the SSO entry point and
 * signing certificate. The explicit fields are for IdPs without a metadata
 * endpoint.
 */
export class SsoConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  metadataUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  entryPoint?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  cert?: string;
}

export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class TwoFactorVerifyDto {
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
