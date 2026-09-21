import type { DevinMode, DevinSession } from "./types";

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

type DevinConfig = {
  apiKey: string;
  orgId: string;
  baseUrl: string;
};

export type CreateSessionInput = {
  prompt: string;
  devinMode?: DevinMode;
  title?: string | null;
  tags?: string[];
};

export type CreatedSession = Pick<
  DevinSession,
  "session_id" | "url" | "status" | "title" | "created_at" | "updated_at" | "tags"
> & {
  devin_mode: DevinMode | null;
};

function resolveConfig(): DevinConfig {
  const apiKey = process.env.DEVIN_API_KEY;
  const orgId = process.env.DEVIN_ORG_ID;
  if (!apiKey) {
    throw new DevinApiError("DEVIN_API_KEY is not set", 401);
  }
  if (!orgId) {
    throw new DevinApiError("DEVIN_ORG_ID is not set", 401);
  }

  return {
    apiKey,
    orgId,
    baseUrl: process.env.DEVIN_API_BASE_URL ?? DEFAULT_BASE_URL,
  };
}

async function apiErrorFromResponse(response: Response): Promise<DevinApiError> {
  let message: string | null = null;
  try {
    const problem = (await response.json()) as { title?: unknown; detail?: unknown };
    const title = typeof problem.title === "string" ? problem.title : null;
    const detail = typeof problem.detail === "string" ? problem.detail : null;
    message = title && detail ? `${title}: ${detail}` : title ?? detail;
  } catch {
    // Use the generic response message when the body is not JSON.
  }

  return new DevinApiError(
    message ?? `Devin API request failed: ${response.status} ${response.statusText}`,
    response.status,
  );
}

async function fetchSessionPages(path: string, limit: number): Promise<DevinSession[]> {
  const { apiKey, orgId, baseUrl } = resolveConfig();
  const pageSize = 100;
  const collected: DevinSession[] = [];
  let cursor: string | null = null;

  while (collected.length < limit) {
    const url = new URL(`/v3/organizations/${encodeURIComponent(orgId)}/${path}`, baseUrl);
    url.searchParams.set("first", String(Math.min(pageSize, limit - collected.length)));
    if (cursor) url.searchParams.set("after", cursor);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    const payload = (await response.json()) as SessionsPage;
    collected.push(...(payload.items ?? []));

    if (!payload.has_next_page || !payload.end_cursor) break;
    cursor = payload.end_cursor;
  }

  return collected.slice(0, limit);
}

/**
 * Fetches sessions via `GET /v3/organizations/{org_id}/sessions/insights` so each
 * item carries `acus_consumed`; falls back to the plain `sessions` endpoint
 * (without spend data) when the service user lacks insights access (403) or the
 * endpoint is unavailable (404).
 */
export async function fetchSessions(limit = 100): Promise<DevinSession[]> {
  try {
    return await fetchSessionPages("sessions/insights", limit);
  } catch (error) {
    if (error instanceof DevinApiError && (error.status === 403 || error.status === 404)) {
      return fetchSessionPages("sessions", limit);
    }
    throw error;
  }
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const { apiKey, orgId, baseUrl } = resolveConfig();
  const body: {
    prompt: string;
    devin_mode?: DevinMode;
    tags?: string[];
    title?: string | null;
  } = {
    prompt: input.prompt,
    ...(input.devinMode === undefined ? {} : { devin_mode: input.devinMode }),
    ...(input.tags === undefined ? { tags: ["cog-autodev"] } : { tags: input.tags }),
    ...(input.title === undefined ? {} : { title: input.title }),
  };
  const url = new URL(`/v3/organizations/${encodeURIComponent(orgId)}/sessions`, baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }

  return (await response.json()) as CreatedSession;
}
