import { z } from "zod";

import {
  reviewItemSchema,
  updateMasterySchema,
  type MasteryStatus,
  type ReviewItem,
} from "@/lib/contracts/mastery";

const reviewItemIdSchema = z.uuid();

export interface MasteryMutationRepository {
  updateStatus(
    id: string,
    status: MasteryStatus,
    now?: Date,
  ): Promise<ReviewItem | null>;
}

export async function updateMasteryResponse(
  idInput: unknown,
  requestInput: unknown,
  dependencies: { repository: MasteryMutationRepository; now?: () => Date },
): Promise<Response> {
  const id = reviewItemIdSchema.safeParse(idInput);
  const request = updateMasterySchema.safeParse(requestInput);
  if (!id.success || !request.success) {
    return Response.json(
      { error: { code: "INVALID_REQUEST", message: "Choose a valid mastery state." } },
      { status: 400 },
    );
  }

  try {
    const item = await dependencies.repository.updateStatus(
      id.data,
      request.data.status,
      (dependencies.now ?? (() => new Date()))(),
    );
    if (!item) {
      return Response.json(
        { error: { code: "REVIEW_ITEM_NOT_FOUND", message: "Review item not found." } },
        { status: 404 },
      );
    }
    return Response.json({ data: { item: reviewItemSchema.parse(item) } });
  } catch {
    return Response.json(
      { error: { code: "MASTERY_UPDATE_FAILED", message: "Mastery could not be saved." } },
      { status: 500 },
    );
  }
}
