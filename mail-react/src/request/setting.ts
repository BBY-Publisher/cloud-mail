import http, { unwrap } from './http';

export interface WebsiteConfig {
  title: string;
  background?: string;
  manyEmail?: number;
  notice?: any;
  domainList?: string[];
  turnstileKey?: string;
  r2Domain?: string;
  loginOpacity?: number;
  hasBrevoWebhookSecret?: boolean;
  [key: string]: unknown;
}

export function settingSet(setting: Record<string, unknown>) {
  return unwrap(http.put('/setting/set', setting));
}

export function settingQuery(): Promise<WebsiteConfig> {
  return unwrap(http.get('/setting/query'));
}

export function websiteConfig(): Promise<WebsiteConfig> {
  return unwrap(http.get('/setting/websiteConfig'));
}

export function setBackground(background: string) {
  return unwrap(http.put('/setting/setBackground', { background }));
}

export function deleteBackground() {
  return unwrap(http.delete('/setting/deleteBackground'));
}

export function setBlackList(params: Record<string, unknown>) {
  return unwrap(http.put('/setting/setBlacklist', params));
}
