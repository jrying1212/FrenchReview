import { unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { LessonId } from "@/lib/contracts/lesson";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";

export type DeleteLessonResult =
  | { status: "deleted" }
  | { status: "deleted_with_cleanup_error" }
  | { status: "not_found" };

export type DeleteLessonOptions = {
  removeFile?: (path: string) => Promise<void>;
  reportCleanupFailure?: (lessonId: LessonId) => void;
  uploadRoot?: string;
};

export function resolveUploadPath(storageKey: string, uploadRoot: string): string {
  if (!storageKey || storageKey.includes("\\")) {
    throw new Error("Unsafe PDF storage key.");
  }

  const root = resolve(uploadRoot);
  const target = resolve(root, storageKey);
  const pathFromRoot = relative(root, target);

  if (
    !pathFromRoot ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Unsafe PDF storage key.");
  }

  return target;
}

export async function deleteLessonAndFile(
  repository: LessonRepository,
  id: LessonId,
  options: DeleteLessonOptions = {},
): Promise<DeleteLessonResult> {
  const lesson = await repository.findById(id);
  if (!lesson) return { status: "not_found" };

  const deleted = await repository.delete(id);
  if (!deleted) return { status: "not_found" };
  if (!lesson.pdfStorageKey) return { status: "deleted" };

  const uploadRoot = options.uploadRoot ?? resolve(process.cwd(), "data/uploads");
  const removeFile = options.removeFile ?? unlink;
  const reportCleanupFailure =
    options.reportCleanupFailure ??
    ((lessonId: LessonId) => {
      console.error("Lesson PDF cleanup failed.", {
        code: "FILE_CLEANUP_FAILED",
        lessonId,
      });
    });

  try {
    await removeFile(resolveUploadPath(lesson.pdfStorageKey, uploadRoot));
    return { status: "deleted" };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { status: "deleted" };
    }

    reportCleanupFailure(id);
    return { status: "deleted_with_cleanup_error" };
  }
}
