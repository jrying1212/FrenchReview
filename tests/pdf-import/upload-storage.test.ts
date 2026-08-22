import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalPdfStore } from "@/lib/storage/local-pdf-store";

const temporaryRoots: string[] = [];

async function createUploadRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "french-review-pdf-"));
  temporaryRoots.push(root);
  return root;
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
