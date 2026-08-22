"use client";

import { useEffect, useId } from "react";

import { useSpeech } from "@/components/speech/speech-provider";

export function SpeakerButton({ text, label }: { text: string; label: string }) {
  const controlId = useId();
  const { activeControlId, speak, stop, supported } = useSpeech();
  const isActive = activeControlId === controlId;

  useEffect(() => () => stop(), [stop]);

  return (
    <span className="speech-actions">
      <button
        aria-label={label}
        className="speaker-button"
        disabled={!supported}
        onClick={() => speak(text, controlId)}
        type="button"
      >
        Hear
      </button>
      {isActive ? (
        <button
          aria-label="Stop French playback"
          className="stop-speech-button"
          onClick={stop}
          type="button"
        >
          Stop
        </button>
      ) : null}
    </span>
  );
}
