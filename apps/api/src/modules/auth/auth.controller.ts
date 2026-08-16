import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, PosPinLoginDto, RegisterDeviceDto, RefreshTokenDto } from "./dto/auth.dto";
import { Public } from "../../common/decorators/public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("pos-pin-login")
  @HttpCode(HttpStatus.OK)
  posPinLogin(@Body() dto: PosPinLoginDto) {
    return this.authService.posPinLogin(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  // Public: a fresh till has no logged-in user yet at first-run pairing time.
  // Physical premises security is the control here, same as real POS hardware
  // pairing flows — this only binds a device UUID to a branch, no data access.
  @Public()
  @Post("register-device")
  @HttpCode(HttpStatus.OK)
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.authService.registerDevice(dto);
  }
}
