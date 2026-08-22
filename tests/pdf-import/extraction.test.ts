import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PDF_TEXT_CODE_POINT_LIMIT,
  PdfImportError,
} from "@/lib/contracts/pdf-import";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";

async function readFixture(name: string): Promise<Uint8Array> {
  return readFile(resolve(process.cwd(), "tests/pdf-import/fixtures", name));
}

describe("PDF text extraction", () => {
  it("preserves French diacritics and reports page and character counts", async () => {
    const bytes = await readFixture("french-multipage.pdf");

    const result = await extractPdfText(bytes);

    expect(result.pageCount).toBe(2);
    expect(result.text).toContain("Leçon de français : déjà étudiée.");
    expect(result.text).toContain("Où est l’école ? À bientôt !");
    expect(result.characterCount).toBe(Array.from(result.text).length);
  });

  it("normalizes horizontal whitespace without rewriting punctuation", async () => {
    const adapter = {
      extract: async () => ({
        pageCount: 1,
        text: "Bonjour,     Élise !\tComment ça va ?",
      }),
    };

    const result = await extractPdfText(new Uint8Array([1]), adapter);

    expect(result.text).toContain("Bonjour, Élise ! Comment ça va ?");
  });

  it("maps a PDF with no selectable text to NO_SELECTABLE_TEXT", async () => {
    const bytes = await readFixture("empty.pdf");

    await expect(extractPdfText(bytes)).rejects.toMatchObject({
      code: "NO_SELECTABLE_TEXT",
    });
  });

  it("maps a password-protected PDF to ENCRYPTED_PDF", async () => {
    const bytes = await readFixture("encrypted.pdf");

    await expect(extractPdfText(bytes)).rejects.toMatchObject({
      code: "ENCRYPTED_PDF",
    });
  });

  it("maps malformed bytes to INVALID_PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nnot a valid PDF");

    await expect(extractPdfText(bytes)).rejects.toMatchObject({
      code: "INVALID_PDF",
    });
  });

  it("maps unexpected adapter failures to IMPORT_FAILED", async () => {
    const reportUnexpectedFailure = vi.fn();
    const adapter = {
      extract: async () => {
        throw new Error("synthetic unexpected failure");
      },
    };

    await expect(
      extractPdfText(new Uint8Array([1]), adapter, reportUnexpectedFailure),
    ).rejects.toEqual(new PdfImportError("IMPORT_FAILED"));
    expect(reportUnexpectedFailure).toHaveBeenCalledOnce();
  });

  it("rejects extracted text over the Unicode code-point limit", async () => {
    const adapter = {
      extract: async () => ({
        pageCount: 1,
        text: "é".repeat(PDF_TEXT_CODE_POINT_LIMIT + 1),
      }),
    };

    await expect(extractPdfText(new Uint8Array([1]), adapter)).rejects.toMatchObject({
      code: "TEXT_TOO_LONG",
    });
  });

  it("counts astral Unicode characters as one code point", async () => {
    const adapter = {
      extract: async () => ({ pageCount: 1, text: "français 👋" }),
    };

    const result = await extractPdfText(new Uint8Array([1]), adapter);

    expect(result.characterCount).toBe(10);
  });
});
