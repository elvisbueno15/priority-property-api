/**
 * Release notes shown in the app's Activity feed ("What's new").
 * Newest first. `kind` is one of: 'new' | 'improve' | 'fix'.
 * Add an entry here every time we ship something — clients pick it up
 * automatically and notify users about the version they just got.
 */
export interface ChangeNote {
  kind: 'new' | 'improve' | 'fix';
  text: string;
}
export interface ReleaseNote {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  notes: ChangeNote[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: '1.0.1',
    date: '2026-07-19',
    title: 'Answer calls in their own window + voice messages',
    notes: [
      { kind: 'new', text: 'Incoming calls now have a clear green Answer button (not just Dismiss)' },
      { kind: 'new', text: 'Calls open in their own resizable window you can maximize to any monitor — perfect for screen sharing and video' },
      { kind: 'new', text: 'Record and send voice messages in chat — tap the mic, then send' },
      { kind: 'improve', text: 'A shared screen or camera now fills the whole call window instead of a small box' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-19',
    title: 'Auto-updating app & release notes',
    notes: [
      { kind: 'new', text: 'The app now updates itself automatically in the background — no more re-downloading' },
      { kind: 'new', text: 'This "What\'s new" panel: every update lists what changed, so you can follow the progress' },
      { kind: 'improve', text: 'Proper Windows installer (no admin needed) that installs in seconds' },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-07-19',
    title: 'Notifications, ringtones & full-screen sharing',
    notes: [
      { kind: 'new', text: 'Desktop notification + sound when you get a new message' },
      { kind: 'new', text: 'Incoming calls now ring until you answer or dismiss' },
      { kind: 'new', text: 'Full-screen button and double-click any video/screen tile — a shared screen now fills the whole monitor' },
      { kind: 'improve', text: 'App keeps running in the system tray so you still get messages and calls after closing the window' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-07-19',
    title: 'File sharing & a bigger call view',
    notes: [
      { kind: 'new', text: 'Send photos, PDFs and files in chat — images preview inline, files download in one click' },
      { kind: 'new', text: 'Maximize the call window for a large, interactive stage (great for screen sharing)' },
      { kind: 'new', text: 'Chat menu: Report a problem and Mute notifications' },
      { kind: 'fix', text: 'Time-tracking screenshots no longer disappear after a server restart' },
      { kind: 'improve', text: 'Clear chat is now hidden inside private conversations' },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-07-18',
    title: 'Fresh professional design',
    notes: [
      { kind: 'new', text: 'Brand-new look inspired by modern messaging suites, with the Inter typeface' },
      { kind: 'new', text: 'Theme picker: Light, Dark and System (follows your computer)' },
      { kind: 'improve', text: 'Redesigned chat with message bubbles, presence and cleaner call controls' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-07-17',
    title: 'Floating call dock',
    notes: [
      { kind: 'new', text: 'Calls now float in a compact dock so you can keep working while you talk' },
      { kind: 'improve', text: 'Faster, cleaner interface across the whole app' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-07-17',
    title: 'Instant calls & password recovery',
    notes: [
      { kind: 'new', text: 'Start a call from any chat or channel with one click' },
      { kind: 'new', text: 'Forgot your password? Reset it by email with a 6-digit code' },
      { kind: 'fix', text: 'Hardened private calls so only invited people can join' },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG.length ? CHANGELOG[0].version : '0.0.0';
