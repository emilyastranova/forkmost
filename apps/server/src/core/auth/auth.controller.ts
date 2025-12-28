import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { MfaService } from './services/mfa.service';
import { SetupGuard } from './guards/setup.guard';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { VerifyUserTokenDto } from './dto/verify-user-token.dto';
import { FastifyReply } from 'fastify';
import { validateSsoEnforcement } from './auth.util';
import { ModuleRef } from '@nestjs/core';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private moduleRef: ModuleRef,
    private mfaService: MfaService,
  ) { }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginInput: LoginDto,
  ) {
    validateSsoEnforcement(workspace);

    const mfaResult = await this.mfaService.checkMfaRequirements(
      loginInput,
      workspace,
      res,
    );

    if (mfaResult) {
      // If user has MFA enabled OR workspace enforces MFA, require MFA verification
      if (mfaResult.userHasMfa || mfaResult.requiresMfaSetup) {
        return {
          userHasMfa: mfaResult.userHasMfa,
          requiresMfaSetup: mfaResult.requiresMfaSetup,
          isMfaEnforced: mfaResult.isMfaEnforced,
        };
      }
    }

    const authToken = await this.authService.login(loginInput, workspace.id);
    this.setAuthCookie(res, authToken);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('mfa/generate')
  async generateMfaSecret(@AuthUser() user: User) {
    return this.mfaService.generateSecret(user);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enable')
  async enableMfa(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: { secret: string; token: string },
  ) {
    return this.mfaService.enableMfa(
      user.id,
      workspace.id,
      body.secret,
      body.token,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('mfa/disable')
  async disableMfa(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.mfaService.disableMfa(user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/setup/generate')
  async setupGenerateMfaSecret(
    @AuthWorkspace() workspace: Workspace,
    @Body() body: LoginDto,
  ) {
    const user = await this.authService.validateUser(
      body.email,
      body.password,
      workspace.id,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.mfaService.generateSecret(user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/setup/enable')
  async setupEnableMfa(
    @AuthWorkspace() workspace: Workspace,
    @Body() body: LoginDto & { secret: string; token: string },
  ) {
    const user = await this.authService.validateUser(
      body.email,
      body.password,
      workspace.id,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.mfaService.enableMfa(
      user.id,
      workspace.id,
      body.secret,
      body.token,
    );
  }



  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify')
  async verifyMfa(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() body: LoginDto & { token: string },
  ) {
    // 1. Verify credentials first
    const authToken = await this.authService.login(body, workspace.id);

    // 2. Decode token to get user ID (or modify authService.login to return user)
    // For now, let's assume we trust the login check. We need the user object.
    // Optimization: authService.login should probably return the user or we call userRepo.
    // Let's rely on MfaService verifying the TOTP against the user found by email.

    // A better approach for step 2:
    const user = await this.authService.validateUser(body.email, body.password, workspace.id);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.mfaService.verifyMfaLogin(user.id, workspace.id, body.token);

    this.setAuthCookie(res, authToken);
    return { authToken };
  }

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    const { workspace, authToken } =
      await this.authService.setup(createAdminUserDto);

    this.setAuthCookie(res, authToken);
    return workspace;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.changePassword(dto, user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    validateSsoEnforcement(workspace);
    return this.authService.forgotPassword(forgotPasswordDto, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset')
  async passwordReset(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() passwordResetDto: PasswordResetDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const result = await this.authService.passwordReset(
      passwordResetDto,
      workspace,
    );

    if (result.requiresLogin) {
      return {
        requiresLogin: true,
      };
    }

    // Set auth cookie if no MFA is required
    this.setAuthCookie(res, result.authToken);
    return {
      requiresLogin: false,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-token')
  async verifyResetToken(
    @Body() verifyUserTokenDto: VerifyUserTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.verifyUserToken(verifyUserTokenDto, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('collab-token')
  async collabToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.getCollabToken(user, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('authToken');
  }

  setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
