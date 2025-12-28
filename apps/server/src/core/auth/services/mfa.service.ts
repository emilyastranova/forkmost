import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as OTPAuth from 'otpauth';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { LoginDto } from '../dto/login.dto';
import { FastifyReply } from 'fastify';
import { TokenService } from './token.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly tokenService: TokenService,
    @InjectKysely() private readonly db: KyselyDB,
  ) { }

  generateSecret(user: User) {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });

    return {
      secret: secret.base32,
      otpauthUrl: totp.toString(),
    };
  }

  async enableMfa(userId: string, workspaceId: string, secret: string, token: string) {
    const isValid = this.verifyToken(token, secret);

    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.db
      .insertInto('userMfa')
      .values({
        userId: userId,
        workspaceId: workspaceId,
        secret: secret,
        isEnabled: true,
        method: 'totp',
      })
      .onConflict((oc) =>
        oc.columns(['userId']).doUpdateSet({
          secret: secret,
          isEnabled: true,
          method: 'totp',
          updatedAt: new Date(),
        }),
      )
      .execute();

    return true;
  }

  async disableMfa(userId: string, workspaceId: string) {
    await this.db
      .deleteFrom('userMfa')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
    return true;
  }

  verifyToken(token: string, secret: string): boolean {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }

  async verifyMfaLogin(userId: string, workspaceId: string, token: string) {
    const userMfa = await this.db
      .selectFrom('userMfa')
      .selectAll()
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!userMfa || !userMfa.isEnabled) {
      throw new UnauthorizedException('MFA not enabled for this user');
    }

    const isValid = this.verifyToken(token, userMfa.secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    return true;
  }

  async checkMfaRequirements(
    loginDto: LoginDto,
    workspace: Workspace,
    res: FastifyReply,
  ) {
    const user = await this.userRepo.findByEmail(loginDto.email, workspace.id, {
      includeUserMfa: true,
    });

    if (!user) {
      // Auth service will handle the error
      return null;
    }

    const userHasMfa = (user as any).mfa?.isEnabled || false;
    const isMfaEnforced = workspace.enforceMfa || false;
    const requiresMfaSetup = isMfaEnforced && !userHasMfa;

    if (userHasMfa) {
      // If code is provided in loginDto (needs to be added to DTO), verify it
      // But for now, we returning metadata so client can redirect
      return {
        userHasMfa: true,
        requiresMfaSetup: false,
        isMfaEnforced,
      };
    }

    if (requiresMfaSetup) {
      return {
        userHasMfa: false,
        requiresMfaSetup: true,
        isMfaEnforced,
      };
    }

    // MFA not required
    return null;
  }
}
