"use client";

import { useEffect } from "react";

const WELCOME_SCRIPT = "Welcome to NovaStaris. Let's print Money.";
const SESSION_KEY = "novastaris_welcome_voice_played";

export function WelcomeVoice() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const speak = () => {
      try {
        const utterance = new SpeechSynthesisUtterance(WELCOME_SCRIPT);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voices = speechSynthesis.getVoices();
        const en = voices.find((v) => v.lang.startsWith("en"));
        if (en) utterance.voice = en;
        speechSynthesis.speak(utterance);
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Speech not supported or blocked
      }
    };

    // Short delay so page is ready; gives time for voices to load in some browsers
    const id = window.setTimeout(speak, 1000);

    return () => clearTimeout(id);
  }, []);

  return null;
}
