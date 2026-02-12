"use client";

import { useEffect } from "react";

const WELCOME_SCRIPT = "Welcome to NovaStaris! Let's print Money.";
const SESSION_KEY = "novastaris_welcome_voice_played";

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
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const speak = () => {
      try {
        const voices = speechSynthesis.getVoices();
        const voice = pickFemaleVoice(voices);
        const utterance = new SpeechSynthesisUtterance(WELCOME_SCRIPT);
        utterance.rate = 1.08;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        speechSynthesis.speak(utterance);
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Speech not supported or blocked
      }
    };

    const run = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) speak();
      else speechSynthesis.onvoiceschanged = () => speak();
    };

    const id = window.setTimeout(run, 1000);
    return () => clearTimeout(id);
  }, []);

  return null;
}
