import { Controller, Get } from '@nestjs/common';
import { CHANGELOG, CURRENT_VERSION } from './changelog';

export const APP_VERSION = CURRENT_VERSION;

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

  /** Release notes shown in the app's "What's new" / Activity feed. */
  @Get('changelog')
  changelog() {
    return { version: APP_VERSION, releases: CHANGELOG };
  }
}
