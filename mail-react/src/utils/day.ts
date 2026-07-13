import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

let currentLang: 'en' | 'zh' = 'en';
dayjs.locale('en');

export function setExtend(lang: 'en' | 'zh') {
  currentLang = lang;
  dayjs.locale(lang === 'en' ? 'en' : 'zh-cn');
}

export function fromNow(date: string | number | Date | null | undefined): string {
  if (!date) return '';
  const d = dayjs.utc(date).tz(timeZone);
  const now = dayjs();
  const diffSeconds = now.diff(d, 'second');
  const diffMinutes = now.diff(d, 'minute');
  const diffHours = now.diff(d, 'hour');
  const isToday = now.isSame(d, 'day');

  if (currentLang === 'en') {
    if (isToday) {
      if (diffSeconds < 60) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes} min ago`;
      if (diffHours < 2) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return d.format('hh:mm A');
    }
    if (now.subtract(1, 'day').isSame(d, 'day')) {
      return d.format('MMM D');
    }
    return d.year() === now.year() ? d.format('MMM D') : d.format('YYYY/MM/DD');
  }

  if (isToday) {
    if (diffSeconds < 60) return '几秒前';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours >= 1 && diffHours < 2) return '1小时前';
    return d.format('HH:mm');
  }
  if (now.subtract(1, 'day').isSame(d, 'day')) return `昨天 ${d.format('HH:mm')}`;
  if (now.subtract(2, 'day').isSame(d, 'day')) return `前天 ${d.format('HH:mm')}`;
  return d.year() === now.year() ? d.format('M月D日') : d.format('YYYY/M/D');
}

export function formatDetailDate(time: string | number | Date | null | undefined): string {
  if (!time) return '';
  const d = dayjs.utc(time).tz(timeZone);
  const now = dayjs();
  const isSameYear = now.year() === d.year();
  if (currentLang === 'en') {
    return isSameYear ? d.format('ddd, MMM D, h:mm A') : d.format('ddd, MMM D, YYYY, h:mm A');
  }
  return d.format('YYYY年M月D日 ddd AH:mm');
}

export function tzDayjs(time: string | number | Date) {
  return dayjs.utc(time).tz(timeZone);
}

export function toUtc(time: string | number | Date) {
  return dayjs(time).utc();
}