import { useContext } from 'react'
import { TranslationContext } from './translationContext'

export function useI18n() {
  const context = useContext(TranslationContext)
  if (!context) throw new Error('useI18n must be used inside TranslationProvider.')
  return context
}
