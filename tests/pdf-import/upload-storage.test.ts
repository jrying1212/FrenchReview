import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import {
  PDF_MAX_BYTES,
  PdfImportError,
  type PdfTextExtractor,
} from "@/lib/contracts/pdf-import";
import type { LessonId } from "@/lib/contracts/lesson";
import {
  importPdf,
  type PdfImportRepository,
} from "@/lib/pdf/import-pdf";
import { pdfParseAdapter } from "@/lib/pdf/pdf-parse-adapter";
import { pdfImportResponse } from "@/lib/pdf/pdf-import-api";
import { PrismaPdfImportRepository } from "@/lib/pdf/prisma-pdf-import-repository";
import { LocalPdfStore } from "@/lib/storage/local-pdf-store";
import type { PdfStore } from "@/lib/storage/local-pdf-store";

const lessonId = "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98" as LessonId;

const temporaryRoots: string[] = [];

async function createUploadRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "french-review-pdf-"));
  temporaryRoots.push(root);
  return root;
}

async function createTestDatabase(): Promise<{ databasePath: string; databaseUrl: string }> {
  const root = await createUploadRoot();
  const databasePath = join(root, "test.db");
  const migration = await readFile(
    join(process.cwd(), "prisma/migrations/20260822090000_init/migration.sql"),
    "utf8",
  );
  const database = new Database(databasePath);
  database.exec(migration);
  database.close();
  return { databasePath, databaseUrl: `file:${databasePath}` };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("local PDF storage", () => {
  it("stages with an opaque key and atomically activates beneath the upload root", async () => {
    const root = await createUploadRoot();
    const store = new LocalPdfStore(root);
    const bytes = new TextEncoder().encode("synthetic PDF bytes");

    const staged = await store.stage(bytes);

    expect(staged.key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await readdir(root)).toEqual([`${staged.key}.tmp`]);

    await store.activate(staged);

    expect(await readdir(root)).toEqual([staged.key]);
    await expect(readFile(join(root, staged.key))).resolves.toEqual(
      Buffer.from(bytes),
    );
  });

  it("discards staged and active files without escaping the upload root", async () => {
    const root = await createUploadRoot();
    const store = new LocalPdfStore(root);
    const staged = await store.stage(new Uint8Array([1, 2, 3]));

    await store.discard(staged);
    await store.discard(staged);
    await expect(readdir(root)).resolves.toEqual([]);

    await expect(store.remove("../outside.pdf")).rejects.toThrow(
      "Unsafe PDF storage key.",
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });
});

function validPdfBytes(size = 16): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-"));
  return bytes;
}

function createPdfFile(name: string): File {
  const bytes = validPdfBytes();
  const file = new File([bytes.buffer as ArrayBuffer], name, {
    type: "application/pdf",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(0),
  });
  return file;
}

function createRepository(storageKey: string | null = null): PdfImportRepository {
  return {
    activateSource: vi.fn(async () => true),
    findSourceState: vi.fn(async () => ({ storageKey })),
  };
}

function createStore(events: string[] = []): PdfStore {
  return {
    activate: vi.fn(async () => {
      events.push("activate-file");
    }),
    discard: vi.fn(async () => {
      events.push("discard-temp");
    }),
    remove: vi.fn(async (key) => {
      events.push(`remove:${key}`);
    }),
    stage: vi.fn(async () => {
      events.push("stage-temp");
      return { key: "11111111-1111-4111-8111-111111111111.pdf" };
    }),
  };
}

const extractor: PdfTextExtractor = {
  extract: vi.fn(async () => ({ pageCount: 2, text: "Leçon prête" })),
};

describe("transactional PDF import", () => {
  it("rejects oversized and non-PDF bytes before staging", async () => {
    const repository = createRepository();
    const store = createStore();

    await expect(
      importPdf(
        { bytes: validPdfBytes(PDF_MAX_BYTES + 1), lessonId, originalName: "large.pdf" },
        { extractor, repository, store },
      ),
    ).rejects.toMatchObject({ code: "PDF_TOO_LARGE" });
    await expect(
      importPdf(
        {
          bytes: new TextEncoder().encode("not a PDF"),
          lessonId,
          originalName: "fake.pdf",
        },
        { extractor, repository, store },
      ),
    ).rejects.toMatchObject({ code: "INVALID_PDF" });
    expect(store.stage).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before replacing an active source", async () => {
    const repository = createRepository("old.pdf");
    const store = createStore();

    await expect(
      importPdf(
        { bytes: validPdfBytes(), lessonId, originalName: "new.pdf" },
        { extractor, repository, store },
      ),
    ).rejects.toMatchObject({ code: "REPLACEMENT_CONFIRMATION_REQUIRED" });
    expect(store.stage).not.toHaveBeenCalled();
    expect(repository.activateSource).not.toHaveBeenCalled();
  });

  it("discards temporary data when extraction fails", async () => {
    const repository = createRepository();
    const events: string[] = [];
    const store = createStore(events);
    const failingExtractor: PdfTextExtractor = {
      extract: vi.fn(async () => {
        throw new PdfImportError("NO_SELECTABLE_TEXT");
      }),
    };

    await expect(
      importPdf(
        { bytes: validPdfBytes(), lessonId, originalName: "empty.pdf" },
        { extractor: failingExtractor, repository, store },
      ),
    ).rejects.toMatchObject({ code: "NO_SELECTABLE_TEXT" });
    expect(events).toEqual(["stage-temp", "discard-temp"]);
    expect(repository.activateSource).not.toHaveBeenCalled();
  });

  it("activates one source and returns extraction metadata", async () => {
    const repository = createRepository();
    const events: string[] = [];
    const store = createStore(events);

    vi.mocked(repository.activateSource).mockImplementation(async (input) => {
      events.push("activate-database");
      expect(input).toMatchObject({
        expectedStorageKey: null,
        lessonId,
        originalName: "lesson.pdf",
        rawText: "Leçon prête",
      });
      return true;
    });

    const result = await importPdf(
      { bytes: validPdfBytes(), lessonId, originalName: "lesson.pdf" },
      { extractor, repository, store },
    );

    expect(result).toEqual({
      characterCount: 11,
      importStatus: "ready",
      lessonId,
      originalName: "lesson.pdf",
      pageCount: 2,
    });
    expect(events).toEqual(["stage-temp", "activate-file", "activate-database"]);
  });

  it("clears the new file if a concurrent database activation wins", async () => {
    const repository = createRepository();
    const events: string[] = [];
    const store = createStore(events);
    vi.mocked(repository.activateSource).mockResolvedValue(false);

    await expect(
      importPdf(
        { bytes: validPdfBytes(), lessonId, originalName: "lesson.pdf" },
        { extractor, repository, store },
      ),
    ).rejects.toMatchObject({ code: "IMPORT_CONFLICT" });
    expect(events).toEqual([
      "stage-temp",
      "activate-file",
      "remove:11111111-1111-4111-8111-111111111111.pdf",
    ]);
  });

  it("deletes the previous source only after a confirmed replacement commits", async () => {
    const repository = createRepository("22222222-2222-4222-8222-222222222222.pdf");
    const events: string[] = [];
    const store = createStore(events);
    vi.mocked(repository.activateSource).mockImplementation(async () => {
      events.push("activate-database");
      return true;
    });

    await importPdf(
      {
        bytes: validPdfBytes(),
        confirmReplacement: true,
        lessonId,
        originalName: "replacement.pdf",
      },
      { extractor, repository, store },
    );

    expect(events).toEqual([
      "stage-temp",
      "activate-file",
      "activate-database",
      "remove:22222222-2222-4222-8222-222222222222.pdf",
    ]);
  });

  it("keeps the previous real file when confirmed replacement extraction fails", async () => {
    const root = await createUploadRoot();
    const store = new LocalPdfStore(root);
    const previous = await store.stage(validPdfBytes());
    await store.activate(previous);
    const repository = createRepository(previous.key);
    const emptyPdf = await readFile(
      join(process.cwd(), "tests/pdf-import/fixtures/empty.pdf"),
    );

    await expect(
      importPdf(
        {
          bytes: emptyPdf,
          confirmReplacement: true,
          lessonId,
          originalName: "empty.pdf",
        },
        { extractor: pdfParseAdapter, repository, store },
      ),
    ).rejects.toMatchObject({ code: "NO_SELECTABLE_TEXT" });

    expect(await readdir(root)).toEqual([previous.key]);
    expect(repository.activateSource).not.toHaveBeenCalled();
  });
});

describe("PDF import persistence", () => {
  it("atomically activates the expected source and invalidates parsed state", async () => {
    const { databasePath, databaseUrl } = await createTestDatabase();
    const database = new Database(databasePath);
    database
      .prepare(
        `INSERT INTO Lesson (
          id, title, pdfStorageKey, pdfOriginalName, rawText, parsedContent,
          importStatus, parseStatus, parseErrorCode, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        lessonId,
        "Lesson",
        "22222222-2222-4222-8222-222222222222.pdf",
        "old.pdf",
        "old text",
        JSON.stringify({ summary: "stale" }),
        "ready",
        "ready",
        "STALE_ERROR",
        "2026-08-22T00:00:00.000Z",
        "2026-08-22T00:00:00.000Z",
      );
    database.close();
    const repository = new PrismaPdfImportRepository({ databaseUrl });

    await expect(
      repository.activateSource({
        expectedStorageKey: "22222222-2222-4222-8222-222222222222.pdf",
        lessonId,
        originalName: "new.pdf",
        rawText: "new text",
        storageKey: "11111111-1111-4111-8111-111111111111.pdf",
      }),
    ).resolves.toBe(true);

    const verification = new Database(databasePath, { readonly: true });
    const record = verification.prepare("SELECT * FROM Lesson WHERE id = ?").get(lessonId);
    verification.close();
    expect(record).toMatchObject({
      importStatus: "ready",
      parseErrorCode: null,
      parsedContent: null,
      parseStatus: "not_started",
      pdfOriginalName: "new.pdf",
      pdfStorageKey: "11111111-1111-4111-8111-111111111111.pdf",
      rawText: "new text",
    });

    await expect(
      repository.activateSource({
        expectedStorageKey: "22222222-2222-4222-8222-222222222222.pdf",
        lessonId,
        originalName: "racing.pdf",
        rawText: "racing text",
        storageKey: "33333333-3333-4333-8333-333333333333.pdf",
      }),
    ).resolves.toBe(false);
    await repository.disconnect();
  });
});

describe("PDF import API contract", () => {
  it("requires exactly one file part", async () => {
    const repository = createRepository();
    const store = createStore();
    const missing = new FormData();
    const duplicate = new FormData();
    duplicate.append("file", createPdfFile("one.pdf"));
    duplicate.append("file", createPdfFile("two.pdf"));

    const missingResponse = await pdfImportResponse(missing, lessonId, {
      extractor,
      repository,
      store,
    });
    const duplicateResponse = await pdfImportResponse(duplicate, lessonId, {
      extractor,
      repository,
      store,
    });

    expect(missingResponse.status).toBe(400);
    expect(duplicateResponse.status).toBe(400);
    await expect(missingResponse.json()).resolves.toMatchObject({
      error: { code: "INVALID_MULTIPART" },
    });
    expect(store.stage).not.toHaveBeenCalled();
  });

  it("returns the stable success envelope", async () => {
    const formData = new FormData();
    formData.append("file", createPdfFile("lesson.pdf"));

    const response = await pdfImportResponse(formData, lessonId, {
      extractor,
      repository: createRepository(),
      store: createStore(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        characterCount: 11,
        importStatus: "ready",
        lessonId,
        originalName: "lesson.pdf",
        pageCount: 2,
      },
    });
  });

  it("maps replacement confirmation and extraction errors deterministically", async () => {
    const formData = new FormData();
    formData.append("file", createPdfFile("lesson.pdf"));
    const confirmationResponse = await pdfImportResponse(formData, lessonId, {
      extractor,
      repository: createRepository("old.pdf"),
      store: createStore(),
    });

    expect(confirmationResponse.status).toBe(409);
    await expect(confirmationResponse.json()).resolves.toMatchObject({
      error: { code: "REPLACEMENT_CONFIRMATION_REQUIRED" },
    });
  });
});
