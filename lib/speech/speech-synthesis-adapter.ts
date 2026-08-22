export interface SpeechAdapter {
  dispose(): void;
  isSupported(): boolean;
  speakFrench(text: string): Promise<void>;
  stop(): void;
}

type SpeechSynthesisAdapterOptions = {
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
  synthesis?: SpeechSynthesis | null;
};

export function isBrowserSpeechSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

export function createSpeechSynthesisAdapter(
  options: SpeechSynthesisAdapterOptions = {},
): SpeechAdapter {
  const synthesis =
    options.synthesis !== undefined
      ? options.synthesis
      : isBrowserSpeechSupported()
        ? window.speechSynthesis
        : null;
  const createUtterance =
    options.createUtterance ??
    (isBrowserSpeechSupported()
      ? (text: string) => new SpeechSynthesisUtterance(text)
      : null);
  let voices = synthesis?.getVoices() ?? [];
  let playbackId = 0;
  let settlePlayback: { id: number; resolve(): void } | null = null;

  function updateVoices() {
    voices = synthesis?.getVoices() ?? [];
  }

  synthesis?.addEventListener("voiceschanged", updateVoices);

  function stop() {
    playbackId += 1;
    synthesis?.cancel();
    settlePlayback?.resolve();
    settlePlayback = null;
  }

  return {
    dispose() {
      stop();
      synthesis?.removeEventListener("voiceschanged", updateVoices);
    },
    isSupported() {
      return synthesis !== null && createUtterance !== null;
    },
    speakFrench(text: string) {
      if (!text.trim()) {
        return Promise.reject(new Error("French speech text is required."));
      }
      if (!synthesis || !createUtterance) {
        return Promise.reject(new Error("Speech synthesis is not supported."));
      }

      stop();
      const currentPlayback = playbackId;
      const utterance = createUtterance(text);
      const normalizedLanguage = (voice: SpeechSynthesisVoice) =>
        voice.lang.toLowerCase().replace("_", "-");
      utterance.lang = "fr-FR";
      utterance.voice =
        voices.find((voice) => normalizedLanguage(voice) === "fr-fr") ??
        voices.find((voice) => normalizedLanguage(voice).startsWith("fr-")) ??
        voices.find((voice) => voice.default) ??
        null;

      return new Promise<void>((resolve, reject) => {
        settlePlayback = { id: currentPlayback, resolve };
        utterance.onend = () => {
          if (settlePlayback?.id === currentPlayback) settlePlayback = null;
          resolve();
        };
        utterance.onerror = () => {
          if (settlePlayback?.id !== currentPlayback) return;
          settlePlayback = null;
          reject(new Error("French speech playback failed."));
        };
        synthesis.speak(utterance);
      });
    },
    stop,
  };
}
