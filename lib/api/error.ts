import { ZodError } from "zod";

interface ErrorHandlingOptions {
  context?: string;
  fallbackMessage?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function withErrorHandling(
  handler: () => Promise<Response>,
  options?: ErrorHandlingOptions
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (options?.context) {
      console.error(`[${options.context}] Error:`, err);
    }

    if (err instanceof ApiError) {
      return Response.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof ZodError) {
      const message = err.issues[0]?.message || "Invalid request body";
      return Response.json({ error: message }, { status: 400 });
    }

    const message =
      err instanceof Error
        ? err.message || options?.fallbackMessage || "Internal server error"
        : options?.fallbackMessage || "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
