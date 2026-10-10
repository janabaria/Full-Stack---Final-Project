import { createContext, useContext } from 'react'

export type Language = 'en' | 'ar'
export type MessageKey =
  | 'login.welcome'
  | 'login.subtitle'
  | 'login.identity'
  | 'login.password'
  | 'login.identityPlaceholder'
  | 'login.passwordPlaceholder'
  | 'login.continue'
  | 'login.localProgress'
  | 'home.eyebrow'
  | 'home.welcome'
  | 'home.signOut'
  | 'home.brief'
  | 'home.rooms'
  | 'home.oneWayOutFirst'
  | 'home.oneWayOutSecond'
  | 'home.description'
  | 'home.enterRoom'
  | 'home.continueGame'
  | 'home.restart'
  | 'home.newInvestigation'
  | 'home.sequence'
  | 'home.path'
  | 'home.cleared'
  | 'home.roomsCompleted'
  | 'home.score'
  | 'home.hintsUsed'
  | 'home.room1'
  | 'home.room1Description'
  | 'home.room2'
  | 'home.room2Description'
  | 'home.room3'
  | 'home.room3Description'
  | 'home.room4'
  | 'home.room4Description'
  | 'home.room5'
  | 'home.room5Description'
  | 'home.unlocked'
  | 'home.goToRoom'
  | 'home.completed'
  | 'home.locked'
  | 'home.unlockInstruction'
  | 'preferences.language'
  | 'preferences.audio'
  | 'preferences.on'
  | 'preferences.off'

export type PreferencesContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  audioEnabled: boolean
  toggleAudio: () => Promise<void>
  audioError: string
  t: (key: MessageKey) => string
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return value
}
