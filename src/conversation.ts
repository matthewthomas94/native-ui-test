import type { PillContent } from './TranscriptionPill'

/** A scripted exchange about the account on the backplate screenshot. */
export const SCRIPT: { user: string; model: string }[] = [
  {
    user: 'How many PayRewards points have I got right now?',
    model:
      "You've got 500,000 PayRewards Points. You haven't spent anything this month yet, and there are no payments waiting for you to authorise.",
  },
  {
    user: 'What happened with my last Bunnings payment?',
    model:
      'Your Bunnings payment of $241.26 on 23 March was cancelled, so no money left your account. If you still need to pay that invoice, I can set up a new payment for the same amount and you would earn points on it as usual. Want me to do that?',
  },
  {
    user: 'Yes, schedule it for this Friday please.',
    model:
      "Done. I've scheduled $241.26 to Bunnings for Friday. You'll find it under Upcoming payments, and you can change or cancel it any time before then.",
  },
]

/**
 * Pill titles per state, from Relay Runner. Its recording hint ("Press Caps Lock to stop and send")
 * points at the talk button here; replies auto-play, so the speaking pill uses its status label.
 */
export const TITLES = {
  listening: 'Start speaking...',
  recording: 'Tap the mic to stop and send',
  sent: 'Sending voice',
  processing: 'Thinking\u2026',
  speaking: 'Playing',
}

export type Phase = 'idle' | 'listening' | 'recording' | 'sent' | 'processing' | 'speaking'

export interface ConversationHooks {
  pill: (c: PillContent | null) => void
  phase: (p: Phase) => void
  /** True once the talk button has been tapped mid-utterance to send it straight away. */
  sendNow: () => boolean
  alive: () => boolean
}

class Stopped extends Error {}

/**
 * Runs while the mic is open: each detected utterance is sent when the speaker stops (or when the
 * talk button is tapped mid-utterance), and the reply plays automatically before the mic listens again. After the script it keeps listening in silence.
 */
export async function runConversation(h: ConversationHooks) {
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => (h.alive() ? resolve() : reject(new Stopped())), ms),
    )
  const listen = () => {
    h.phase('listening')
    h.pill({ title: TITLES.listening, theme: 'stt' })
  }
  try {
    for (const turn of SCRIPT) {
      // Listening: compact until speech is detected.
      listen()
      await wait(1400)

      // Speech detected: live transcription grows word by word in the full pill.
      h.phase('recording')
      let partial = ''
      for (const word of turn.user.split(' ')) {
        if (h.sendNow()) break
        partial = partial ? `${partial} ${word}` : word
        h.pill({ title: TITLES.recording, body: partial, theme: 'stt' })
        await wait(170 + Math.random() * 190)
      }
      // The speaker stops; after a beat of silence it sends (unless tapped to send already).
      if (!h.sendNow()) await wait(800)

      h.phase('sent')
      h.pill({ title: TITLES.sent, theme: 'stt' })
      await wait(650)

      h.phase('processing')
      h.pill({ title: TITLES.processing, theme: 'tts' })
      await wait(1400 + Math.random() * 600)

      // The reply auto-plays, at roughly speech pace.
      h.phase('speaking')
      h.pill({ title: TITLES.speaking, body: turn.model, theme: 'tts' })
      await wait(Math.max(3200, turn.model.split(' ').length * 380))
    }
    // Script done: the mic stays open, listening to silence, until it is closed.
    listen()
    for (;;) await wait(1000)
  } catch (e) {
    if (!(e instanceof Stopped)) throw e
  }
}
