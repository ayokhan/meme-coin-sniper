"use client";

import { useEffect, useRef } from "react";

const WELCOME_SCRIPT = "Welcome to NovaStaris! Let's print Money.";
const SESSION_KEY = "novastaris_welcome_voice_played";
const COINS_SOUND_PATH = "/sounds/coins-pour.mp3.wav";

// Prefer female voices (names vary by OS/browser)
const FEMALE_VOICE_HINTS = [
  "female",
  "woman",
  "zira",
  "samantha",
  "karen",
  "victoria",
  "aria",
  "lucy",
  "emily",
  "susan",
  "hazel",
  "fiona",
  "kate",
  "moira",
  "tessa",
  "sara",
  "alva",
  "anna",
  "melina",
  "google uk english female",
  "microsoft zira",
  "microsoft aria",
];

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lower = (s: string) => s.toLowerCase();
  const en = voices.filter((v) => v.lang.startsWith("en"));
  for (const hint of FEMALE_VOICE_HINTS) {
    const found = en.find((v) => lower(v.name).includes(hint));
    if (found) return found;
  }
  return en[0] ?? voices[0] ?? null;
}

export function WelcomeVoice() {
  const played = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const playCoinsFallback = () => {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const playClink = (start: number, freq: number, decay: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          osc.frequency.exponentialRampToValueAtTime(100, start + decay);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
          osc.start(start);
          osc.stop(start + decay);
        };
        const t = ctx.currentTime;
        [2800, 2400, 3200, 2600, 3000].forEach((f, i) => playClink(t + i * 0.06, f, 0.12));
      } catch {
        // Web Audio not supported
      }
    };

    // Preload and unlock audio in the same user gesture so play() in onend is allowed
    let coinAudio: HTMLAudioElement | null = null;

    const playCoinsSound = () => {
      if (played.current) return;
      played.current = true;
      const audio = coinAudio ?? new Audio(COINS_SOUND_PATH);
      audio.volume = 0.7;
      const onError = () => playCoinsFallback();
      audio.addEventListener("error", onError, { once: true });
      audio.currentTime = 0;
      audio.play().catch(onError);
    };

    const runWelcome = () => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      try {
        coinAudio = new Audio(COINS_SOUND_PATH);
        coinAudio.volume = 0;
        coinAudio.preload = "auto";
        // Unlock audio in this user gesture so play() in onend is allowed
        coinAudio.play().then(() => {
          coinAudio?.pause();
          if (coinAudio) {
            coinAudio.currentTime = 0;
            coinAudio.volume = 0.7;
          }
        }).catch(() => {});

        const voices = speechSynthesis.getVoices();
        const voice = pickFemaleVoice(voices);
        const utterance = new SpeechSynthesisUtterance(WELCOME_SCRIPT);
        utterance.rate = 1.08;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        utterance.onend = () => playCoinsSound();
        speechSynthesis.speak(utterance);
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Speech not supported or blocked
      }
    };

    const startOnInteraction = () => {
      runWelcome();
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("keydown", startOnInteraction);
    };

    // Prefer starting on first user interaction so the coin sound is allowed (browsers often block audio from callbacks)
    document.addEventListener("click", startOnInteraction, { once: true });
    document.addEventListener("keydown", startOnInteraction, { once: true });

    // Fallback: auto-start after 2s if no interaction (voice may work; coin may be blocked)
    const id = window.setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      runWelcome();
    }, 2000);

    return () => {
      clearTimeout(id);
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("keydown", startOnInteraction);
    };
  }, []);

  return null;
}
