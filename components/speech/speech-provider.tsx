"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import {
  createSpeechSynthesisAdapter,
  isBrowserSpeechSupported,
  type SpeechAdapter,
} from "@/lib/speech/speech-synthesis-adapter";

type SpeechContextValue = {
  activeControlId: string | null;
  speak(text: string, controlId: string): void;
  stop(): void;
  supported: boolean;
};

const SpeechContext = createContext<SpeechContextValue | null>(null);
const subscribeToSupport = () => () => undefined;

export function SpeechProvider({
  adapter,
  children,
}: {
  adapter?: SpeechAdapter;
  children: ReactNode;
}) {
  const adapterRef = useRef<SpeechAdapter | null>(adapter ?? null);
  const playbackId = useRef(0);
  const [activeControlId, setActiveControlId] = useState<string | null>(null);
  const [activeText, setActiveText] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const supported = useSyncExternalStore(
    subscribeToSupport,
    () => adapter?.isSupported() ?? isBrowserSpeechSupported(),
    () => false,
  );

  const getAdapter = useCallback(() => {
    adapterRef.current ??= createSpeechSynthesisAdapter();
    return adapterRef.current;
  }, []);

  const stop = useCallback(() => {
    playbackId.current += 1;
    adapterRef.current?.stop();
    setActiveControlId(null);
    setActiveText(null);
  }, []);

  const speak = useCallback((text: string, controlId: string) => {
    const currentPlayback = ++playbackId.current;
    setPlaybackError("");
    setActiveControlId(controlId);
    setActiveText(text);
    void getAdapter()
      .speakFrench(text)
      .catch(() => {
        if (playbackId.current === currentPlayback) {
          setPlaybackError("French audio could not be played. Try again.");
        }
      })
      .finally(() => {
        if (playbackId.current === currentPlayback) {
          setActiveControlId(null);
          setActiveText(null);
        }
      });
  }, [getAdapter]);

  useEffect(
    () => () => {
      adapterRef.current?.stop();
      adapterRef.current?.dispose();
    },
    [],
  );

  return (
    <SpeechContext.Provider
      value={{ activeControlId, speak, stop, supported }}
    >
      {!supported ? (
        <p className="speech-support-note" role="note">
          French audio requires browser and operating-system speech support.
          All written review content remains available.
        </p>
      ) : null}
      {playbackError ? (
        <p className="form-alert" role="alert">
          {playbackError}
        </p>
      ) : null}
      {activeText ? (
        <p className="visually-hidden" role="status">
          Playing {activeText} in French.
        </p>
      ) : null}
      {children}
    </SpeechContext.Provider>
  );
}

export function useSpeech() {
  const context = useContext(SpeechContext);
  if (!context) throw new Error("SpeakerButton requires SpeechProvider.");
  return context;
}
