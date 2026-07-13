import { useSettingStore } from '@/store/setting';

export function cvtR2Url(key: string | undefined | null): string {
  if (!key) return '';
  if (key.startsWith('https://') || key.startsWith('http://')) return key;

  const { settings } = useSettingStore.getState();
  const domain = settings?.r2Domain;

  if (!domain) return key;

  const cleanDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;

  return `${cleanDomain}/${cleanKey}`;
}

export function toOssDomain(domain: string | undefined | null): string {
  if (!domain) return '';
  let d = domain.trim();
  if (!d.startsWith('https://') && !d.startsWith('http://')) {
    d = 'https://' + d;
  }
  return d.endsWith('/') ? d.slice(0, -1) : d;
}