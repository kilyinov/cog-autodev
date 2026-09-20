import type { DevinSessionSummary } from "./types";

const DEFAULT_BASE_URL = "https://api.devin.ai";

export class DevinApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DevinApiError";
  }
}

export function isDevinApiConfigured(): boolean {
  return Boolean(process.env.DEVIN_API_KEY);
}

/**
 * Fetches session summaries from `GET /v1/sessions`, paginating until `limit`
 * sessions are collected or the API runs out of results.
 */
export async function fetchSessions(limit = 100): Promise<DevinSessionSummary[]> {
  const apiKey = process.env.DEVIN_API_KEY;
  if (!apiKey) {
    throw new DevinApiError("DEVIN_API_KEY is not set", 401);
  }

  const baseUrl = process.env.DEVIN_API_BASE_URL ?? DEFAULT_BASE_URL;
  const pageSize = 100;
  const collected: DevinSessionSummary[] = [];

  while (collected.length < limit) {
    const url = new URL("/v1/sessions", baseUrl);
    url.searchParams.set("limit", String(Math.min(pageSize, limit - collected.length)));
    url.searchParams.set("offset", String(collected.length));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new DevinApiError(
        `Devin API request failed: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const payload = (await response.json()) as { sessions?: DevinSessionSummary[] };
    const page = payload.sessions ?? [];
    collected.push(...page);

    if (page.length < pageSize) break;
  }

  return collected.slice(0, limit);
}
