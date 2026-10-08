import { createContext } from 'react'

export type Language = 'en' | 'ar'

export type TranslationContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (text: string, values?: Record<string, string | number>) => string
}

export const TranslationContext = createContext<TranslationContextValue | null>(null)
