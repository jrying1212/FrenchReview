import type {
  CreateLessonInput,
  Lesson,
  LessonId,
  UpdateLessonInput,
} from "@/lib/contracts/lesson";

export interface LessonRepository {
  create(input: CreateLessonInput): Promise<Lesson>;
  list(): Promise<Lesson[]>;
  findById(id: LessonId): Promise<Lesson | null>;
  update(id: LessonId, input: UpdateLessonInput): Promise<Lesson | null>;
  delete(id: LessonId): Promise<boolean>;
}
