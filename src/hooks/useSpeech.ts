import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { speakText } from "@/lib/tts.functions";

type Status = "idle" | "loading" | "playing" | "paused";

/**
 * Full-output read-aloud. Prefers the secure server-side ElevenLabs Hermes
 * voice; falls back to the browser speech engine when no provider key is set.
 */
export function useSpeech() {
  const speak = useServerFn(speakText);
  const [status, setStatus] = useState<Status>("idle");
  const [speed, setSpeed] = useState(1);
  const [engine, setEngine] = useState<"hermes" | "browser" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastText = useRef<string>("");

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(
    async (text: string) => {
      stop();
      const clean = text.trim();
      if (!clean) return;
      lastText.current = clean;
      setStatus("loading");
      try {
        const res = await speak({ data: { text: clean.slice(0, 5000), speed } });
        if (res.audio) {
          const audio = new Audio(`data:audio/mpeg;base64,${res.audio}`);
          audio.playbackRate = speed;
          audio.onended = () => setStatus("idle");
          audioRef.current = audio;
          setEngine("hermes");
          await audio.play();
          setStatus("playing");
          return;
        }
      } catch {
        /* fall through to browser speech */
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = speed;
        utter.onend = () => setStatus("idle");
        setEngine("browser");
        window.speechSynthesis.speak(utter);
        setStatus("playing");
      } else {
        setStatus("idle");
      }
    },
    [speak, speed, stop],
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) void audioRef.current.play();
    else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.resume();
    setStatus("playing");
  }, []);

  const replay = useCallback(() => void play(lastText.current), [play]);

  return { status, engine, speed, setSpeed, play, pause, resume, stop, replay };
}
