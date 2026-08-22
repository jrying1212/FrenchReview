import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export type StagedPdf = Readonly<{
  key: string;
}>;

export interface PdfStore {
  stage(bytes: Uint8Array): Promise<StagedPdf>;
  activate(staged: StagedPdf): Promise<void>;
  discard(staged: StagedPdf): Promise<void>;
  remove(key: string): Promise<void>;
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export class LocalPdfStore implements PdfStore {
  readonly #root: string;

  constructor(root = join(process.cwd(), "data", "uploads")) {
    this.#root = root;
  }

  async stage(bytes: Uint8Array): Promise<StagedPdf> {
    const staged = { key: `${randomUUID()}.pdf` } as const;
    await mkdir(this.#root, { recursive: true });
    await writeFile(this.#temporaryPath(staged), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    return staged;
  }

  async activate(staged: StagedPdf): Promise<void> {
    await rename(this.#temporaryPath(staged), this.#activePath(staged.key));
  }

  async discard(staged: StagedPdf): Promise<void> {
    await unlinkIfPresent(this.#temporaryPath(staged));
  }

  async remove(key: string): Promise<void> {
    await unlinkIfPresent(this.#activePath(key));
  }

  #activePath(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) {
      throw new Error("Unsafe PDF storage key.");
    }

    return join(this.#root, key);
  }

  #temporaryPath(staged: StagedPdf): string {
    return `${this.#activePath(staged.key)}.tmp`;
  }
}
