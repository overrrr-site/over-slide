import { z } from "zod";
import { ApiError } from "@/lib/api/error";

type JsonBody = Awaited<ReturnType<Request["json"]>>;

export async function parseJsonBody(request: Request): Promise<JsonBody> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
}

export async function parseJsonWithSchema<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const body = await parseJsonBody(request);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Invalid request body";
    throw new ApiError(message, 400);
  }

  return parsed.data;
}

export function assertInput(
  condition: unknown,
  message = "Invalid request body",
  status = 400
): asserts condition {
  if (!condition) {
    throw new ApiError(message, status);
  }
}
