import type { DevinSession } from "./types";

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
  return Boolean(process.env.DEVIN_API_KEY && process.env.DEVIN_ORG_ID);
}

type SessionsPage = {
  items?: DevinSession[];
  end_cursor?: string | null;
  has_next_page?: boolean;
};

/**
 * Fetches sessions from `GET /v3/organizations/{org_id}/sessions`, following
 * `end_cursor` until `limit` sessions are collected or the API runs out.
 */
export async function fetchSessions(limit = 100): Promise<DevinSession[]> {
  const apiKey = process.env.DEVIN_API_KEY;
  const orgId = process.env.DEVIN_ORG_ID;
  if (!apiKey) {
    throw new DevinApiError("DEVIN_API_KEY is not set", 401);
  }
  if (!orgId) {
    throw new DevinApiError("DEVIN_ORG_ID is not set", 401);
  }

  const baseUrl = process.env.DEVIN_API_BASE_URL ?? DEFAULT_BASE_URL;
  const pageSize = 100;
  const collected: DevinSession[] = [];
  let cursor: string | null = null;

  while (collected.length < limit) {
    const url = new URL(`/v3/organizations/${encodeURIComponent(orgId)}/sessions`, baseUrl);
    url.searchParams.set("first", String(Math.min(pageSize, limit - collected.length)));
    if (cursor) url.searchParams.set("after", cursor);

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

    const payload = (await response.json()) as SessionsPage;
    collected.push(...(payload.items ?? []));

    if (!payload.has_next_page || !payload.end_cursor) break;
    cursor = payload.end_cursor;
  }

  return collected.slice(0, limit);
}
