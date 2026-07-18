import { Controller, Get } from '@nestjs/common';

export const APP_VERSION = '0.6.0';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', now: new Date().toISOString() };
  }

  @Get('version')
  version() {
    return { version: APP_VERSION };
  }
}
