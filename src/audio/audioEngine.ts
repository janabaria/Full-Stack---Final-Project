export type MusicTrack =
  | 'home'
  | 'room-1'
  | 'room-2'
  | 'room-3'
  | 'room-4'
  | 'room-5'
  | 'victory'

export type AudioPreferences = {
  musicEnabled: boolean
  effectsEnabled: boolean
  volume: number
}

const PREFERENCES_KEY = 'escape-room-audio-preferences-v1'
const defaultPreferences: AudioPreferences = {
  musicEnabled: true,
  effectsEnabled: true,
  volume: 0.85,
}

type TrackDefinition = {
  drones: number[]
  motif: number[]
  interval: number
  wave: OscillatorType
  fadeIn: number
}

type TrackVoice = {
  gain: GainNode
  oscillators: OscillatorNode[]
  intervalId: number
}

const tracks: Record<MusicTrack, TrackDefinition> = {
  home: { drones: [55, 82.41], motif: [220, 261.63, 329.63, 392], interval: 2200, wave: 'sine', fadeIn: 1.8 },
  'room-1': { drones: [55, 82.41, 110], motif: [220, 261.63, 311.13, 293.66], interval: 1850, wave: 'sine', fadeIn: 1.5 },
  'room-2': { drones: [65.41, 98], motif: [196, 233.08, 261.63, 233.08], interval: 2100, wave: 'triangle', fadeIn: 1.5 },
  'room-3': { drones: [36.71, 55, 73.42], motif: [146.83, 220, 174.61, 130.81], interval: 2500, wave: 'sine', fadeIn: 1.8 },
  'room-4': { drones: [58.27, 87.31, 116.54], motif: [207.65, 246.94, 311.13, 277.18], interval: 1450, wave: 'triangle', fadeIn: 1.5 },
  'room-5': { drones: [32.7, 49, 65.41], motif: [110, 146.83, 174.61, 146.83], interval: 2800, wave: 'sine', fadeIn: 2 },
  victory: { drones: [65.41, 98, 130.81], motif: [261.63, 329.63, 392, 523.25], interval: 1450, wave: 'triangle', fadeIn: 1.2 },
}

let context: AudioContext | null = null
let masterBus: GainNode | null = null
let musicBus: GainNode | null = null
let effectsBus: GainNode | null = null
let activeTrack: TrackVoice | null = null
let activeTrackName: MusicTrack | null = null
let requestedTrack: MusicTrack = 'home'
let pendingTrackStart: number | null = null
let trackTransitionId = 0
let visibilityListenerAttached = false
let preferences = readPreferences()
let lastUiSoundAt = 0

function readPreferences(): AudioPreferences {
  try {
    const saved = window.localStorage.getItem(PREFERENCES_KEY)
    if (!saved) return defaultPreferences

    const parsed = JSON.parse(saved) as Partial<AudioPreferences>
    return {
      musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
      effectsEnabled: typeof parsed.effectsEnabled === 'boolean' ? parsed.effectsEnabled : true,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.85,
    }
  } catch {
    return defaultPreferences
  }
}

function persistPreferences() {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.error('Could not save audio preferences.', error)
  }
}

function ensureAudioGraph(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (context) return context

  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return null

  context = new AudioContextConstructor()
  masterBus = context.createGain()
  musicBus = context.createGain()
  effectsBus = context.createGain()
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -8
  limiter.knee.value = 8
  limiter.ratio.value = 5
  limiter.attack.value = 0.004
  limiter.release.value = 0.24
  musicBus.connect(masterBus)
  effectsBus.connect(masterBus)
  masterBus.connect(limiter)
  limiter.connect(context.destination)
  masterBus.gain.value = preferences.volume
  musicBus.gain.value = preferences.musicEnabled ? 0.95 : 0
  effectsBus.gain.value = preferences.effectsEnabled ? 1 : 0

  if (!visibilityListenerAttached) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        setGain(effectsBus, 0, 0.08)
        trackTransitionId += 1
        if (pendingTrackStart !== null) {
          window.clearTimeout(pendingTrackStart)
          pendingTrackStart = null
        }
        if (activeTrack) {
          stopTrack(activeTrack, 0.25)
          activeTrack = null
          activeTrackName = null
        }
      } else if (preferences.musicEnabled && context?.state === 'running') {
        setGain(effectsBus, preferences.effectsEnabled ? 1 : 0, 0.08)
        setMusicTrack(requestedTrack)
      } else {
        setGain(effectsBus, preferences.effectsEnabled ? 1 : 0, 0.08)
      }
    })
    visibilityListenerAttached = true
  }

  return context
}

function setGain(gain: GainNode | null, value: number, duration = 0.2) {
  if (!gain || !context) return
  const now = context.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setTargetAtTime(value, now, Math.max(0.01, duration / 3))
}

function stopTrack(voice: TrackVoice, fadeSeconds: number) {
  if (!context) return
  const now = context.currentTime
  if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') {
    voice.gain.gain.cancelAndHoldAtTime(now)
  } else {
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
  }
  voice.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds)
  window.clearInterval(voice.intervalId)
  window.setTimeout(() => {
    for (const oscillator of voice.oscillators) {
      try {
        oscillator.stop()
      } catch {
        // Oscillators that already ended need no cleanup.
      }
    }
    voice.gain.disconnect()
  }, fadeSeconds * 1000 + 100)
}

function playMotifNote(voice: TrackVoice, definition: TrackDefinition, index: number) {
  if (!context || !musicBus) return

  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  const now = context.currentTime
  const frequency = definition.motif[index % definition.motif.length]

  oscillator.type = definition.wave
  oscillator.frequency.setValueAtTime(frequency, now)
  envelope.gain.setValueAtTime(0.0001, now)
  envelope.gain.exponentialRampToValueAtTime(0.28, now + 0.08)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.35)
  oscillator.connect(envelope)
  envelope.connect(voice.gain)
  oscillator.start(now)
  oscillator.stop(now + 1.4)
  oscillator.onended = () => {
    oscillator.disconnect()
    envelope.disconnect()
  }
}

function startTrack(track: MusicTrack) {
  if (!context || !musicBus || !preferences.musicEnabled) return

  const definition = tracks[track]
  const groupGain = context.createGain()
  groupGain.gain.setValueAtTime(0.0001, context.currentTime)
  groupGain.gain.linearRampToValueAtTime(0.72, context.currentTime + definition.fadeIn)
  groupGain.connect(musicBus)

  const oscillators: OscillatorNode[] = []
  for (const frequency of definition.drones) {
    const oscillator = context.createOscillator()
    const volume = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    volume.gain.value = 0.3 / definition.drones.length
    oscillator.connect(volume)
    volume.connect(groupGain)
    oscillator.start()
    oscillators.push(oscillator)
  }

  const voice: TrackVoice = { gain: groupGain, oscillators, intervalId: 0 }
  let noteIndex = 0
  playMotifNote(voice, definition, noteIndex++)
  voice.intervalId = window.setInterval(() => {
    playMotifNote(voice, definition, noteIndex++)
  }, definition.interval)
  activeTrack = voice
  activeTrackName = track
}

function playTone(
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  wave: OscillatorType = 'sine',
) {
  if (!context || !effectsBus) return
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = wave
  oscillator.frequency.setValueAtTime(frequency, startAt)
  envelope.gain.setValueAtTime(0.0001, startAt)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), startAt + 0.025)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(envelope)
  envelope.connect(effectsBus)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.03)
  oscillator.onended = () => {
    oscillator.disconnect()
    envelope.disconnect()
  }
}

function playApplause(startAt: number, duration: number) {
  if (!context || !effectsBus) return
  const sampleCount = Math.floor(context.sampleRate * duration)
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / sampleCount, 2)
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  filter.type = 'highpass'
  filter.frequency.value = 1500
  envelope.gain.setValueAtTime(0.0001, startAt)
  envelope.gain.linearRampToValueAtTime(0.12, startAt + 0.15)
  envelope.gain.linearRampToValueAtTime(0.0001, startAt + duration)
  source.buffer = buffer
  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(effectsBus)
  source.start(startAt)
  source.stop(startAt + duration)
}

export function getAudioPreferences() {
  return { ...preferences }
}

export function unlockAudio() {
  const audioContext = ensureAudioGraph()
  if (!audioContext) return false
  void audioContext.resume().then(() => {
    if (preferences.musicEnabled) setMusicTrack(requestedTrack)
  }).catch((error: unknown) => {
    console.error('Could not start game audio.', error)
  })
  return true
}

export function setMusicTrack(track: MusicTrack) {
  requestedTrack = track
  if (!preferences.musicEnabled || !context) return
  if (activeTrackName === track) return

  if (pendingTrackStart !== null) {
    window.clearTimeout(pendingTrackStart)
    pendingTrackStart = null
  }

  const transitionId = ++trackTransitionId
  const previousTrack = activeTrack
  if (previousTrack) {
    stopTrack(previousTrack, 0.45)
    activeTrack = null
    activeTrackName = null
  }

  const startNext = () => {
    pendingTrackStart = null
    if (transitionId !== trackTransitionId || !preferences.musicEnabled || requestedTrack !== track) return
    startTrack(track)
  }

  if (previousTrack) {
    pendingTrackStart = window.setTimeout(startNext, 460)
  } else {
    startNext()
  }
}

export function updateAudioPreferences(next: AudioPreferences) {
  preferences = {
    musicEnabled: next.musicEnabled,
    effectsEnabled: next.effectsEnabled,
    volume: Math.max(0, Math.min(1, next.volume)),
  }
  persistPreferences()

  if (masterBus) setGain(masterBus, preferences.volume)
  if (musicBus) setGain(musicBus, preferences.musicEnabled ? 0.95 : 0)
  if (effectsBus) setGain(effectsBus, preferences.effectsEnabled ? 1 : 0)

  if (!preferences.musicEnabled && activeTrack) {
    trackTransitionId += 1
    if (pendingTrackStart !== null) {
      window.clearTimeout(pendingTrackStart)
      pendingTrackStart = null
    }
    stopTrack(activeTrack, 0.8)
    activeTrack = null
    activeTrackName = null
  } else if (preferences.musicEnabled && context) {
    setMusicTrack(requestedTrack)
  }
}

export function playUiSound() {
  if (!preferences.effectsEnabled || !context || context.state !== 'running') return
  const now = performance.now()
  if (now - lastUiSoundAt < 80) return
  lastUiSoundAt = now
  playTone(740, context.currentTime, 0.075, 0.018, 'sine')
}

export function playSuccessSound() {
  if (!preferences.effectsEnabled) return
  const audioContext = ensureAudioGraph()
  if (!audioContext || audioContext.state !== 'running') return
  const now = audioContext.currentTime + 0.04
  ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
  playTone(frequency, now + index * 0.11, 0.7, 0.22, 'triangle')
  })
}

export async function playAudioPreview() {
  const audioContext = ensureAudioGraph()
  if (!audioContext) return false

  try {
    await audioContext.resume()
    const now = audioContext.currentTime + 0.04
    ;[659.25, 783.99, 1046.5].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.16, 0.55, 0.22, 'triangle')
    })
    return true
  } catch (error) {
    console.error('Could not play the audio preview.', error)
    return false
  }
}

export function playFailureSound() {
  const audioContext = ensureAudioGraph()
  if (!audioContext || audioContext.state !== 'running') return
  if (activeTrack) {
    trackTransitionId += 1
    if (pendingTrackStart !== null) {
      window.clearTimeout(pendingTrackStart)
      pendingTrackStart = null
    }
    stopTrack(activeTrack, 1.2)
    activeTrack = null
    activeTrackName = null
  }
  const now = audioContext.currentTime + 0.04
  ;[130.81, 123.47, 110].forEach((frequency, index) => {
    playTone(frequency, now + index * 0.38, 0.62, 0.22, 'sawtooth')
  })
}

export function playVictorySound(isNewHighScore = false) {
  const audioContext = ensureAudioGraph()
  if (!audioContext || audioContext.state !== 'running') return
  const now = audioContext.currentTime + 0.05
  const melody = [523.25, 659.25, 783.99, 1046.5]
  melody.forEach((frequency, index) => {
    playTone(frequency, now + index * 0.2, 1.35, 0.2, 'triangle')
    if (index > 0) playTone(frequency / 2, now + index * 0.2, 1.5, 0.11, 'sine')
  })
  playApplause(now + 0.75, isNewHighScore ? 3.8 : 2.5)

  if (isNewHighScore) {
    playRecordCelebration(now + 1.1)
  }
}

export function playRecordCelebration(startAt?: number) {
  const audioContext = ensureAudioGraph()
  if (!audioContext || audioContext.state !== 'running') return
  const now = startAt ?? audioContext.currentTime + 0.04
  ;[1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
    playTone(frequency, now + index * 0.16, 1.5, 0.18, 'triangle')
  })
  playApplause(now + 0.2, 3.8)
}
