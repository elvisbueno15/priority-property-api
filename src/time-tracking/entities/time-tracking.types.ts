export type TimeEntryStatus = 'active' | 'inactive' | 'paused' | 'unknown';

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  startTime: Date;
  endTime: Date | null;
  status: TimeEntryStatus;
  activityPercent: number;
  idleTimeMs: number;
  createdBy?: string;
}

export interface AppUsageSnapshot {
  id?: string;
  userId: string;
  projectId: string;
  appName: string;
  domain: string;
  capturedAt: Date;
}

export interface ScreenshotRecord {
  id?: string;
  userId: string;
  projectId: string;
  capturedAt: Date;
  path: string;
}

export interface TimeTrackingSettings {
  screenshotIntervalMinutes: number;
  allowMonitoring: boolean;
}
