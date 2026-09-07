"use client";

import { useEffect, useRef } from "react";

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
  const enUs = en.find((v) => v.lang.startsWith("en-US"));
  const enGb = en.find((v) => v.lang.startsWith("en-GB"));
  return enUs ?? enGb ?? en[0];
}

/** Module guard — sessionStorage alone can race when onvoiceschanged fires multiple times. */
let welcomeSpeakStarted = false;

export function WelcomeVoice() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) || welcomeSpeakStarted || startedRef.current) return;

    const markPlayed = () => {
      welcomeSpeakStarted = true;
      startedRef.current = true;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode */
      }
    };

    const doSpeak = () => {
      if (welcomeSpeakStarted || startedRef.current || sessionStorage.getItem(SESSION_KEY)) return;
      if (!("speechSynthesis" in window)) return;

      try {
        markPlayed();
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices();
        const voice = pickFemaleVoice(voices);
        const utterance = new SpeechSynthesisUtterance(WELCOME_SCRIPT);
        utterance.rate = 1.12;
        utterance.pitch = 1.25;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Speech not supported or blocked
      }
    };

    const runWelcome = () => {
      if (welcomeSpeakStarted || startedRef.current || sessionStorage.getItem(SESSION_KEY)) return;
      if (!("speechSynthesis" in window)) return;

      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          doSpeak();
          return;
        }
        const onVoices = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
          doSpeak();
        };
        window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      } catch {
        // Speech not supported or blocked
      }
    };

    const startOnInteraction = () => {
      runWelcome();
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("keydown", startOnInteraction);
    };

    document.addEventListener("click", startOnInteraction, { once: true });
    document.addEventListener("keydown", startOnInteraction, { once: true });

    const id = window.setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY) || welcomeSpeakStarted) return;
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
