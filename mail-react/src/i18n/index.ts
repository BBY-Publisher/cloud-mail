import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh';
import en from './en';

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: localStorage.getItem('i18n-lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export function setI18nLang(lang: 'en' | 'zh') {
  i18n.changeLanguage(lang);
  localStorage.setItem('i18n-lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}