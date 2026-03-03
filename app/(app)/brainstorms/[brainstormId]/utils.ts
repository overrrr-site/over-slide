import type { DiscussionChatMessage, DiscussionMessagePart } from "./types";

export function extractTextFromParts(parts: DiscussionMessagePart[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

export function getMessageText(
  message: Pick<DiscussionChatMessage, "parts">
): string {
  return extractTextFromParts(message.parts) || "";
}
