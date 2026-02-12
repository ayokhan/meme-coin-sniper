"use client";

import { useEffect } from "react";

const WELCOME_SCRIPT = "Welcome to NovaStaris! Let's print Money.";
const SESSION_KEY = "novastaris_welcome_voice_played";

// Prefer female voices — order matters: explicit "female" and well‑known names first
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
  "nicole",
  "google uk english female",
  "google us english female",
  "microsoft zira",
  "microsoft zira desktop",
  "microsoft aria",
];

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lower = (s: string) => s.toLowerCase();
  const en = voices.filter((v) => v.lang.startsWith("en"));
  if (en.length === 0) return voices[0] ?? null;
  for (const hint of FEMALE_VOICE_HINTS) {
    const found = en.find((v) => lower(v.name).includes(hint));
    if (found) return found;
  }
  // Last resort: prefer en-US or en-GB; avoid first if it's often male
  const enUs = en.find((v) => v.lang.startsWith("en-US"));
  const enGb = en.find((v) => v.lang.startsWith("en-GB"));
  return enUs ?? enGb ?? en[0];
}

export function WelcomeVoice() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const runWelcome = () => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      const doSpeak = () => {
        try {
          const voices = speechSynthesis.getVoices();
          const voice = pickFemaleVoice(voices);
          const utterance = new SpeechSynthesisUtterance(WELCOME_SCRIPT);
          utterance.rate = 1.12;
          utterance.pitch = 1.25;
          utterance.volume = 1;
          if (voice) utterance.voice = voice;
          speechSynthesis.speak(utterance);
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // Speech not supported or blocked
        }
      };
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) doSpeak();
      else speechSynthesis.onvoiceschanged = () => doSpeak();
    };

    const startOnInteraction = () => {
      runWelcome();
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("keydown", startOnInteraction);
    };

    document.addEventListener("click", startOnInteraction, { once: true });
    document.addEventListener("keydown", startOnInteraction, { once: true });

    const id = window.setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      runWelcome();
    }, 1500);

    return () => {
      clearTimeout(id);
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("keydown", startOnInteraction);
    };
  }, []);

  return null;
}
