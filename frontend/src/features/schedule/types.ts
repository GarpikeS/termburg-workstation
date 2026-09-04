export type SchedulePriceKind = 'free' | 'paid';

export interface ScheduleLocation {
  id: string;
  city: string;
  name: string;
  shortName: string;
  address: string;
  timezone: string;
}

export interface ScheduleEvent {
  id: string;
  locationId: string;
  daysOfWeek: number[];
  time: string;
  endTime?: string;
  title: string;
  venue: string;
  details?: string;
  priceKind: SchedulePriceKind;
  price?: number;
  published: boolean;
  highlight?: boolean;
}

export interface ScheduleException {
  id: string;
  locationId: string;
  date: string;
  time: string;
  endTime?: string;
  title: string;
  venue: string;
  details?: string;
  priceKind: SchedulePriceKind;
  price?: number;
  published: boolean;
  highlight?: boolean;
  closed?: boolean;
  sanitaryDay?: boolean;
}

export interface MonthlyPosterEvent {
  id: string;
  date: string;
  title: string;
  imageDataUrl?: string;
  program: string;
}

export interface MonthlyPoster {
  id: string;
  locationId: string;
  month: string;
  events: MonthlyPosterEvent[];
}

export interface ScheduleData {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  locations: ScheduleLocation[];
  weeklyEvents: ScheduleEvent[];
  exceptions: ScheduleException[];
  monthlyPosters: MonthlyPoster[];
}

export type ScheduleViewMode = 'day' | 'week' | 'month';

export type ScheduleItem = (ScheduleEvent | ScheduleException) & {
  occurrenceDate: string;
  isException: boolean;
};

export interface ScheduleSaveResult {
  data: ScheduleData;
  synced: boolean;
  message: string;
}

export interface ScheduleEditorUser {
  username: 'moscow' | 'zelenogorsk';
  locationId: '1' | '2';
}

export interface ScheduleAuthStatus {
  configured: boolean;
  authenticated: boolean;
  user: ScheduleEditorUser | null;
  disabled?: boolean;
}

export type SiteSyncAuthMode = 'bearer' | 'x-api-key';

export interface SiteSyncSettings {
  locationId: string;
  endpoint: string;
  authMode: SiteSyncAuthMode;
  complexCode: string;
  hasToken: boolean;
  tokenHint: string;
  lastPublishedAt: string;
  lastPublishedCount: number | null;
}

export interface SiteSyncPublishResult {
  ok: true;
  imported: number;
  endpoint: string;
  remoteStatus: number;
  remoteResponse: unknown;
  publishedAt: string;
}
