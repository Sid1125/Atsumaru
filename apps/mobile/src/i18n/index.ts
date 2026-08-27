import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import type { Language } from "../types/api";

const SUPPORTED: Language[] = ["en", "ja", "zh"];

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? "en";
  return SUPPORTED.includes(code as Language) ? (code as Language) : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    zh: { translation: zh },
  },
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(language: Language) {
  return i18n.changeLanguage(language);
}

export default i18n;
