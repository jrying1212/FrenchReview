import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpeakerButton } from "@/components/speech/speaker-button";
import { SpeechProvider } from "@/components/speech/speech-provider";
import {
  createSpeechSynthesisAdapter,
  type SpeechAdapter,
} from "@/lib/speech/speech-synthesis-adapter";

type FakeUtterance = {
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  text: string;
  voice: SpeechSynthesisVoice | null;
};

function voice(lang: string, isDefault = false) {
  return { default: isDefault, lang, name: lang } as SpeechSynthesisVoice;
}

function createBrowserSpeech(voices: SpeechSynthesisVoice[]) {
  let currentVoices = voices;
  let voicesChanged: (() => void) | null = null;
  const utterances: FakeUtterance[] = [];
  const synthesis = {
    addEventListener: vi.fn((_name: string, listener: () => void) => {
      voicesChanged = listener;
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => currentVoices),
    removeEventListener: vi.fn(),
    speak: vi.fn((utterance: FakeUtterance) => utterances.push(utterance)),
  };
  const adapter = createSpeechSynthesisAdapter({
    createUtterance: (text) => ({
      lang: "",
      onend: null,
      onerror: null,
      text,
      voice: null,
    }) as SpeechSynthesisUtterance,
    synthesis: synthesis as unknown as SpeechSynthesis,
  });
  return {
    adapter,
    setVoices(next: SpeechSynthesisVoice[]) {
      currentVoices = next;
      voicesChanged?.();
    },
    synthesis,
    utterances,
  };
}

afterEach(cleanup);

describe("speech synthesis adapter", () => {
  it("cancels stale speech and speaks exact text with exact fr-FR preference", () => {
    const browser = createBrowserSpeech([
      voice("en-US", true),
      voice("fr-CA"),
      voice("fr-FR"),
    ]);

    void browser.adapter.speakFrench("Où est l’école ?");

    expect(browser.synthesis.cancel).toHaveBeenCalledOnce();
    expect(browser.utterances[0]).toMatchObject({
      lang: "fr-FR",
      text: "Où est l’école ?",
      voice: expect.objectContaining({ lang: "fr-FR" }),
    });
  });

  it("falls back to another French voice, then the browser default", () => {
    const french = createBrowserSpeech([voice("en-US", true), voice("fr-CA")]);
    void french.adapter.speakFrench("Bonjour");
    expect(french.utterances[0].voice?.lang).toBe("fr-CA");

    const fallback = createBrowserSpeech([voice("en-GB"), voice("en-US", true)]);
    void fallback.adapter.speakFrench("Salut");
    expect(fallback.utterances[0].voice?.lang).toBe("en-US");
  });

  it("uses voices populated after voiceschanged and rejects blank text", async () => {
    const browser = createBrowserSpeech([]);
    browser.setVoices([voice("fr-FR")]);

    void browser.adapter.speakFrench("Élise");
    expect(browser.utterances[0].voice?.lang).toBe("fr-FR");
    await expect(browser.adapter.speakFrench("   ")).rejects.toThrow(
      "French speech text is required.",
    );
  });

  it("stop and dispose cancel speech and settle active playback", async () => {
    const browser = createBrowserSpeech([voice("fr-FR")]);
    const playback = browser.adapter.speakFrench("Bonjour");
    browser.adapter.stop();
    await expect(playback).resolves.toBeUndefined();
    browser.adapter.dispose();

    expect(browser.synthesis.cancel).toHaveBeenCalledTimes(3);
    expect(browser.synthesis.removeEventListener).toHaveBeenCalledOnce();
  });

  it("ignores a cancelled utterance ending after replay starts", async () => {
    const browser = createBrowserSpeech([voice("fr-FR")]);
    void browser.adapter.speakFrench("Bonjour");
    const replay = browser.adapter.speakFrench("Bonjour");

    browser.utterances[0].onend?.();
    browser.adapter.stop();

    await expect(replay).resolves.toBeUndefined();
  });
});

describe("speaker controls", () => {
  it("supports replay, stop, live status, and unmount cleanup", async () => {
    let finish: (() => void) | undefined;
    const adapter: SpeechAdapter = {
      dispose: vi.fn(),
      isSupported: () => true,
      speakFrench: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
      stop: vi.fn(() => finish?.()),
    };
    const view = render(
      <SpeechProvider adapter={adapter}>
        <SpeakerButton label="Hear bonjour in French" text="bonjour" />
      </SpeechProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hear bonjour in French" }));
    expect(adapter.speakFrench).toHaveBeenCalledWith("bonjour");
    expect(screen.getByRole("status")).toHaveTextContent("Playing bonjour in French.");
    expect(screen.getByRole("button", { name: "Stop French playback" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Hear bonjour in French" }));
    expect(adapter.speakFrench).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Stop French playback" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop French playback" })).toBeNull(),
    );
    view.unmount();
    expect(adapter.stop).toHaveBeenCalled();
    expect(adapter.dispose).toHaveBeenCalledOnce();
  });

  it("shows stop only beside the duplicate-text control that started playback", () => {
    const adapter: SpeechAdapter = {
      dispose: vi.fn(),
      isSupported: () => true,
      speakFrench: vi.fn(() => new Promise<void>(() => undefined)),
      stop: vi.fn(),
    };
    render(
      <SpeechProvider adapter={adapter}>
        <SpeakerButton label="Hear first bonjour" text="bonjour" />
        <SpeakerButton label="Hear second bonjour" text="bonjour" />
      </SpeechProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hear first bonjour" }));

    expect(
      screen.getAllByRole("button", { name: "Stop French playback" }),
    ).toHaveLength(1);
  });

  it("disables audio with an explanation while retaining study content", () => {
    const adapter: SpeechAdapter = {
      dispose: vi.fn(),
      isSupported: () => false,
      speakFrench: vi.fn(),
      stop: vi.fn(),
    };
    render(
      <SpeechProvider adapter={adapter}>
        <p>Où est l’école ?</p>
        <SpeakerButton label="Hear sentence in French" text="Où est l’école ?" />
      </SpeechProvider>,
    );

    expect(screen.getByText("Où est l’école ?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hear sentence in French" })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent(
      "French audio requires browser and operating-system speech support.",
    );
  });
});
