import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  PreferencesContext,
  type Language,
  type MessageKey,
} from './preferencesContext'

const messages: Record<Language, Record<MessageKey, string>> = {
  en: {
    'login.welcome': 'Welcome back',
    'login.subtitle': 'Sign in to continue your escape.',
    'login.identity': 'EMAIL OR USERNAME',
    'login.password': 'PASSWORD',
    'login.identityPlaceholder': 'investigator@example.com',
    'login.passwordPlaceholder': 'Enter your password',
    'login.continue': 'CONTINUE',
    'login.localProgress': 'Progress saves locally. Cloud sync is optional.',
    'home.eyebrow': 'YOUR INVESTIGATION BEGINS',
    'home.welcome': 'Welcome to MAZORA',
    'home.signOut': 'SIGN OUT',
    'home.brief': 'MISSION BRIEF',
    'home.rooms': '05 ROOMS',
    'home.oneWayOutFirst': 'Five rooms.',
    'home.oneWayOutSecond': 'One way out.',
    'home.description': 'Solve each room’s puzzles to uncover the next door. Your escape begins here.',
    'home.enterRoom': 'ENTER ROOM 1',
    'home.continueGame': 'CONTINUE GAME',
    'home.restart': 'RESTART CAMPAIGN',
    'home.newInvestigation': 'NEW INVESTIGATION',
    'home.sequence': 'THE ESCAPE SEQUENCE',
    'home.path': 'Your path through the rooms',
    'home.cleared': 'CLEARED',
    'home.roomsCompleted': 'ROOMS COMPLETED',
    'home.score': 'SCORE',
    'home.hintsUsed': 'HINTS USED',
    'home.room1': 'THE MISSING MESSAGE',
    'home.room1Description': 'An abandoned office. A message out of order.',
    'home.room2': 'THE INTERVIEW',
    'home.room2Description': 'Every answer hides a fragment of the code.',
    'home.room3': 'THE SECURITY WING',
    'home.room3Description': 'Bypass the systems and find the keycard.',
    'home.room4': 'THE MYSTERIOUS STUDY',
    'home.room4Description': 'Search the room to find hidden items and unlock the door.',
    'home.room5': 'THE LAST LOCK',
    'home.room5Description': 'One final truth stands between you and freedom.',
    'home.unlocked': 'UNLOCKED',
    'home.goToRoom': 'GO TO ROOM',
    'home.completed': 'COMPLETED',
    'home.locked': 'LOCKED',
    'home.unlockInstruction': 'Complete Room',
    'preferences.language': 'Language',
    'preferences.audio': 'Sound effects',
    'preferences.on': 'On',
    'preferences.off': 'Off',
  },
  ar: {
    'login.welcome': 'مرحبًا بعودتك',
    'login.subtitle': 'سجّل الدخول لمتابعة الهروب.',
    'login.identity': 'البريد الإلكتروني أو اسم المستخدم',
    'login.password': 'كلمة المرور',
    'login.identityPlaceholder': 'investigator@example.com',
    'login.passwordPlaceholder': 'أدخل كلمة المرور',
    'login.continue': 'متابعة',
    'login.localProgress': 'يُحفظ التقدم على جهازك. المزامنة السحابية اختيارية.',
    'home.eyebrow': 'تبدأ مغامرتك الآن',
    'home.welcome': 'مرحبًا بك في مازورا',
    'home.signOut': 'تسجيل الخروج',
    'home.brief': 'موجز المهمة',
    'home.rooms': '٥ غرف',
    'home.oneWayOutFirst': 'خمس غرف.',
    'home.oneWayOutSecond': 'وطريق واحد للخروج.',
    'home.description': 'حل ألغاز كل غرفة لاكتشاف الباب التالي. يبدأ هروبك من هنا.',
    'home.enterRoom': 'ادخل الغرفة الأولى',
    'home.continueGame': 'متابعة اللعبة',
    'home.restart': 'إعادة بدء الحملة',
    'home.newInvestigation': 'تحقيق جديد',
    'home.sequence': 'تسلسل الهروب',
    'home.path': 'طريقك عبر الغرف',
    'home.cleared': 'مكتملة',
    'home.roomsCompleted': 'الغرف المكتملة',
    'home.score': 'النقاط',
    'home.hintsUsed': 'التلميحات المستخدمة',
    'home.room1': 'الرسالة المفقودة',
    'home.room1Description': 'مكتب مهجور ورسالة مبعثرة.',
    'home.room2': 'المقابلة',
    'home.room2Description': 'كل إجابة تخفي جزءًا من الرمز.',
    'home.room3': 'جناح الأمن',
    'home.room3Description': 'تجاوز الأنظمة وابحث عن بطاقة الدخول.',
    'home.room4': 'الدراسة الغامضة',
    'home.room4Description': 'فتّش الغرفة واعثر على الأدوات المخفية لفتح الباب.',
    'home.room5': 'القفل الأخير',
    'home.room5Description': 'حقيقة أخيرة تفصلك عن الحرية.',
    'home.unlocked': 'مفتوحة',
    'home.goToRoom': 'اذهب إلى الغرفة',
    'home.completed': 'مكتملة',
    'home.locked': 'مغلقة',
    'home.unlockInstruction': 'أكمل الغرفة',
    'preferences.language': 'اللغة',
    'preferences.audio': 'المؤثرات الصوتية',
    'preferences.on': 'تشغيل',
    'preferences.off': 'إيقاف',
  },
}

const PREFERENCES_STORAGE_KEY = 'mazora-preferences-v1'
type SavedPreferences = {
  language: Language
}

function loadPreferences(): SavedPreferences {
  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!saved) return { language: 'en' }
    const parsed: unknown = JSON.parse(saved)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Saved preferences are not an object.')
    }
    const value = parsed as Partial<SavedPreferences>
    return {
      language: value.language === 'ar' ? 'ar' : 'en',
    }
  } catch (error) {
    console.error('Could not load MAZORA preferences.', error)
    return { language: 'en' }
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [saved] = useState(loadPreferences)
  const [language, setLanguage] = useState<Language>(saved.language)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [audioError, setAudioError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(async () => {
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) {
      throw new Error('Audio playback is not supported by this browser.')
    }
    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor()
    if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume()
    return audioContextRef.current
  }, [])

  const toggleAudio = useCallback(async () => {
    setAudioError('')
    if (audioEnabled) {
      setAudioEnabled(false)
      return
    }

    try {
      await getAudioContext()
      setAudioEnabled(true)
    } catch (error) {
      console.error('Could not toggle MAZORA audio.', error)
      setAudioError('Sound effects could not start. Check your browser audio settings.')
    }
  }, [audioEnabled, getAudioContext])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
        language,
      }))
    } catch (error) {
      console.error('Could not save MAZORA preferences.', error)
    }
  }, [language])

  useEffect(() => {
    if (!audioEnabled) return

    const playEffect = (event: MouseEvent) => {
      if (!(event.target instanceof Element) ||
        !event.target.closest('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])')) return
      const context = audioContextRef.current
      if (!context || context.state !== 'running') return
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(620, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(420, context.currentTime + .055)
      gain.gain.setValueAtTime(.018, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .06)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + .065)
    }

    document.addEventListener('click', playEffect)
    return () => document.removeEventListener('click', playEffect)
  }, [audioEnabled])

  const t = useCallback((key: MessageKey) => messages[language][key], [language])
  const value = useMemo(() => ({
    language,
    setLanguage,
    audioEnabled,
    toggleAudio,
    audioError,
    t,
  }), [language, audioEnabled, toggleAudio, audioError, t])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
