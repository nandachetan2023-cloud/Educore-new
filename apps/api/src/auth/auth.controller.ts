import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto';
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

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user);
  }
}
