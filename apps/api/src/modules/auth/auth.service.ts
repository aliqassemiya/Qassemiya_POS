import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokens, LoginInput, PosPinLoginInput, RegisterDeviceInput } from "@qassemiya/shared-types";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { AuthenticatedUser } from "../../common/types/auth-request";
import type { AccessTokenPayload } from "../../common/strategies/jwt.strategy";
import { buildAuthUser, type AuthUserView } from "../../common/auth/auth-user.util";

const MS_UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 15 * 60_000; // fallback: 15m
  return Number(match[1]) * MS_UNITS[match[2]];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresMs: number;
  /** POS refresh tokens (bound to a paired device) stay valid until explicit logout. */
  private readonly deviceRefreshExpiresMs = 365 * 86_400_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessSecret = this.config.get<string>("JWT_SECRET")!;
    this.accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    this.refreshExpiresMs = parseDuration(this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d");
  }

  async login(input: LoginInput): Promise<AuthTokens & { user: AuthUserView }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const tokens = await this.issueTokenPair(user.id);
    return { ...tokens, user: await buildAuthUser(this.prisma, user.id) };
  }

  async posPinLogin(input: PosPinLoginInput): Promise<AuthTokens & { user: AuthUserView }> {
    const device = await this.prisma.device.findUnique({ where: { deviceUuid: input.deviceUuid } });
    if (!device || !device.isActive) throw new UnauthorizedException("Device is not paired or inactive");

    const employee = await this.prisma.employee.findUnique({ where: { employeeCode: input.employeeCode } });
    if (!employee || !employee.isActive) throw new UnauthorizedException("Invalid employee code or PIN");
    if (employee.branchId !== device.branchId) {
      throw new UnauthorizedException("Employee does not belong to this device's branch");
    }
    if (!employee.userId || !employee.pinCodeHash) {
      throw new UnauthorizedException("Employee has no linked login account");
    }

    const validPin = await argon2.verify(employee.pinCodeHash, input.pinCode);
    if (!validPin) throw new UnauthorizedException("Invalid employee code or PIN");

    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

    const tokens = await this.issueTokenPair(employee.userId, {
      deviceId: device.id,
      deviceBranchId: device.branchId,
      employeeId: employee.id,
    });
    return { ...tokens, user: await buildAuthUser(this.prisma, employee.userId) };
  }

  async registerDevice(input: RegisterDeviceInput) {
    const branch = await this.prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw new ConflictException("Branch does not exist");

    return this.prisma.device.upsert({
      where: { deviceUuid: input.deviceUuid },
      update: { name: input.name, branchId: input.branchId, isActive: true },
      create: { id: newId(), deviceUuid: input.deviceUuid, name: input.name, branchId: input.branchId },
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException("Invalid refresh token");

    if (stored.revoked) {
      // Reuse of an already-rotated (or logged-out) token => treat as compromise.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException("Refresh token reuse detected; session revoked");
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    return this.issueTokenPair(
      stored.userId,
      stored.deviceId ? { deviceId: stored.deviceId, deviceBranchId: undefined } : undefined,
      { rotateFromId: stored.id, familyId: stored.familyId },
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revoked: false },
      data: { revoked: true },
    });
  }

  async getAuthenticatedUserGrants(userId: string): Promise<AuthenticatedUser["grants"]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const byBranch = new Map<string | null, Set<string>>();
    for (const ur of userRoles) {
      const set = byBranch.get(ur.branchId) ?? new Set<string>();
      for (const rp of ur.role.rolePermissions) set.add(rp.permission.code);
      byBranch.set(ur.branchId, set);
    }

    return Array.from(byBranch.entries()).map(([branchId, permissions]) => ({
      branchId,
      permissions: Array.from(permissions) as AuthenticatedUser["grants"][number]["permissions"],
    }));
  }

  private async issueTokenPair(
    userId: string,
    device?: { deviceId?: string; deviceBranchId?: string; employeeId?: string },
    rotate?: { rotateFromId: string; familyId: string },
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException("User is inactive");

    const grants = await this.getAuthenticatedUserGrants(userId);

    let deviceBranchId = device?.deviceBranchId;
    let employeeId = device?.employeeId;
    if (device?.deviceId && !deviceBranchId) {
      const d = await this.prisma.device.findUnique({ where: { id: device.deviceId } });
      deviceBranchId = d?.branchId;
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      grants,
      deviceBranchId,
      employeeId,
    };
    const accessToken = this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: this.accessExpiresIn });

    const rawRefreshToken = randomBytes(48).toString("base64url");
    const familyId = rotate?.familyId ?? newId();
    const isDeviceBound = Boolean(device?.deviceId);
    const expiresAt = new Date(Date.now() + (isDeviceBound ? this.deviceRefreshExpiresMs : this.refreshExpiresMs));

    const created = await this.prisma.refreshToken.create({
      data: {
        id: newId(),
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        deviceId: device?.deviceId,
        expiresAt,
      },
    });

    if (rotate?.rotateFromId) {
      await this.prisma.refreshToken.update({
        where: { id: rotate.rotateFromId },
        data: { revoked: true, replacedByTokenId: created.id },
      });
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: Math.floor(parseDuration(this.accessExpiresIn) / 1000),
    };
  }
}
