import { createContext, useContext, useState } from "react";
import { translations } from "./i18n";

const LanguageContext = createContext(null);

const LANG_KEY = "triviaPool.language";

function loadLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || "EN";
  } catch {
    return "EN";
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadLanguage());

  function setLanguage(code) {
    setLanguageState(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      // ignore storage errors
    }
  }

  function t(key) {
    return translations[language]?.[key] ?? translations.EN[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}