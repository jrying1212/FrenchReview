"use client";

import { useId, useRef, useState } from "react";

import {
  masteryLabels,
  masteryStatusSchema,
  reviewItemSchema,
  type MasteryStatus,
  type ReviewItem,
} from "@/lib/contracts/mastery";

type SaveStatus = (id: string, status: MasteryStatus) => Promise<ReviewItem>;

const statuses = masteryStatusSchema.options;

export function MasteryControl({
  item,
  itemLabel,
  onSaved,
  saveStatus = saveMasteryStatus,
}: {
  item: ReviewItem;
  itemLabel: string;
  onSaved?: (item: ReviewItem) => void;
  saveStatus?: SaveStatus;
}) {
  const controlId = useId();
  const [selectedStatus, setSelectedStatus] = useState(item.status);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "status">("status");
  const [isSaving, setIsSaving] = useState(false);
  const durableStatus = useRef(item.status);
  const desiredStatus = useRef(item.status);
  const saving = useRef(false);

  function choose(status: MasteryStatus) {
    desiredStatus.current = status;
    setSelectedStatus(status);
    setMessage("");
    void drainSaves();
  }

  async function drainSaves() {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);

    while (desiredStatus.current !== durableStatus.current) {
      const target = desiredStatus.current;
      let acknowledged: ReviewItem | null = null;
      try {
        const saved = await saveStatus(item.id, target);
        durableStatus.current = saved.status;
        if (desiredStatus.current === target) {
          desiredStatus.current = saved.status;
          setSelectedStatus(saved.status);
          setMessageKind("status");
          setMessage(`Saved as ${masteryLabels[saved.status]}.`);
          acknowledged = saved;
        }
      } catch {
        if (desiredStatus.current === target) {
          desiredStatus.current = durableStatus.current;
          setSelectedStatus(durableStatus.current);
          setMessageKind("error");
          setMessage("Could not save. Your previous choice was restored.");
        }
      }
      if (acknowledged) onSaved?.(acknowledged);
    }

    saving.current = false;
    setIsSaving(false);
  }

  return (
    <fieldset
      aria-busy={isSaving}
      aria-label={`Mastery for ${itemLabel}`}
      className="mastery-control"
    >
      <legend>Mastery</legend>
      <div className="mastery-options">
        {statuses.map((status) => (
          <label key={status}>
            <input
              checked={selectedStatus === status}
              name={`${controlId}-mastery`}
              onChange={() => choose(status)}
              type="radio"
              value={status}
            />
            <span>{masteryLabels[status]}</span>
          </label>
        ))}
      </div>
      <p
        className={`mastery-message mastery-message-${messageKind}`}
        role={messageKind === "error" ? "alert" : "status"}
      >
        {message || (isSaving ? "Saving…" : "")}
      </p>
    </fieldset>
  );
}

async function saveMasteryStatus(
  id: string,
  status: MasteryStatus,
): Promise<ReviewItem> {
  const response = await fetch(`/api/review-items/${id}`, {
    body: JSON.stringify({ status }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || !isRecord(body.data)) {
    throw new Error("Mastery update failed.");
  }
  return reviewItemSchema.parse(body.data.item);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
