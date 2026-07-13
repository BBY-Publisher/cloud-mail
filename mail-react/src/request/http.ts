import axios, { type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n';

export const TOKEN_KEY = 'token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => {
  if (token === null) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
};

declare module 'axios' {
  export interface AxiosRequestConfig {
    noMsg?: boolean;
  }
}

export interface ApiEnvelope<T = unknown> {
  code: number;
  data: T;
  message?: string;
}

const http = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const lang = (localStorage.getItem('i18n-lang') as 'en' | 'zh') || 'en';
  config.headers.set('Authorization', getToken() || '');
  config.headers.set('accept-language', lang);
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope>) => {
    const { data } = response;
    const noMsg = response.config.noMsg;

    if (data.code === 401) {
      if (!noMsg) toast.error(data.message || i18n.t('networkErrorMsg'));
      setToken(null);
      window.location.replace('/login');
      throw data;
    }

    if (data.code === 403) {
      if (!noMsg) toast.warning(data.message || '');
      throw data;
    }

    if (data.code === 502) {
      if (!noMsg) toast.error(data.message || '');
      throw data;
    }

    if (data.code !== 200) {
      if (!noMsg) toast.error(data.message || i18n.t('reqFailErrorMsg'));
      throw data;
    }

    return response;
  },
  (error) => {
    if (error?.response?.status === 403) {
      window.location.reload();
      return Promise.reject(error);
    }
    const noMsg = error?.config?.noMsg;
    if (noMsg) return Promise.reject(error);

    const message = String(error?.message || '');
    if (message.includes('Network Error')) {
      toast.error(i18n.t('networkErrorMsg'));
    } else if (error?.code === 'ECONNABORTED') {
      toast.error(i18n.t('timeoutErrorMsg'));
    } else if (error?.response) {
      toast.error(i18n.t('serverBusyErrorMsg'));
    } else {
      toast.error(i18n.t('reqFailErrorMsg'));
    }
    return Promise.reject(error);
  },
);

/** Unwrap `data.data` from a successful axios response. */
export async function unwrap<T>(promise: Promise<AxiosResponse<unknown>>): Promise<T> {
  const res = await promise;
  const envelope = res.data as ApiEnvelope<T>;
  return envelope.data;
}

export default http;