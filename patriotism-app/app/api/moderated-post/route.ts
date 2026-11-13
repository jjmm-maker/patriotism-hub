import { NextResponse } from "next/server";
import {
  checkRateLimit,
  readJsonSafely,
} from "@/lib/api-protection";


type PostBody = {
  kind?: "discussion" | "reply";
  title?: string;
  body?: string;
  group_id?: string | null;
  discussion_id?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function basicSafetyCheck(content: string) {
  const threatPattern =
    /\b(i will|i'll|im going to|i am going to|we will|we're going to)\s+(kill|hurt|attack|shoot|burn)\b/i;

  const urls = content.match(/https?:\/\/\S+/gi) ?? [];

  if (threatPattern.test(content)) {
    return {
      allowed: false,
      message:
        "This message appears to contain a threat. Please rewrite it respectfully.",
      mode: "rules" as const,
    };
  }

  if (urls.length >= 4) {
    return {
      allowed: false,
      message:
        "This message contains too many links and may be spam. Please review it.",
      mode: "rules" as const,
    };
  }

  return { allowed: true, message: "", mode: "rules" as const };
}

async function moderate(content: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return basicSafetyCheck(content);

  const response = await fetch(
    "https://api.openai.com/v1/moderations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: content,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error("MODERATION_UNAVAILABLE");

  const result = (await response.json()) as {
    results?: Array<{ flagged?: boolean }>;
  };

  if (!result.results?.length) {
    throw new Error("MODERATION_UNAVAILABLE");
  }

  const flagged = result.results[0].flagged === true;

  return {
    allowed: !flagged,
    message: flagged
      ? "This message was flagged by the safety check. Please revise it or contact an administrator if you believe this is a mistake."
      : "",
    mode: "ai" as const,
  };
}

function serviceHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function getRows<T>(
  baseUrl: string,
  key: string,
  table: string,
  filters: Record<string, string>,
): Promise<T[]> {
  const endpoint = new URL(`/rest/v1/${table}`, baseUrl);
  endpoint.searchParams.set("select", "*");

  for (const [field, value] of Object.entries(filters)) {
    endpoint.searchParams.set(field, value);
  }

  const response = await fetch(endpoint, {
    headers: serviceHeaders(key),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("DATABASE_READ_FAILED");

  return (await response.json()) as T[];
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait before trying again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !publishableKey || !serviceKey) {
      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete. Contact the administrator.",
        },
        { status: 500 },
      );
    }

    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    const authResponse = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 },
      );
    }

    const authUser = (await authResponse.json()) as { id?: string };

    if (!authUser.id) {
      return NextResponse.json(
        { error: "Unable to verify your account." },
        { status: 401 },
      );
    }

    // Shared per-user key: both moderation endpoints use the same quota.
    const limit = checkRateLimit(`moderation:${authUser.id}`);

    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSeconds);
    }

    const parsed = await readJsonSafely(request);

    if (!parsed.ok) {
      return NextResponse.json(
        {
          error:
            parsed.reason === "too_large"
              ? "Request body is too large. The maximum is 16 KB."
              : "Invalid JSON request body.",
        },
        { status: parsed.reason === "too_large" ? 413 : 400 },
      );
    }

    if (
      typeof parsed.value !== "object" ||
      parsed.value === null ||
      Array.isArray(parsed.value)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const body = parsed.value as PostBody;
    const kind = body.kind;

    if (kind !== "discussion" && kind !== "reply") {
      return NextResponse.json(
        { error: "Invalid post type." },
        { status: 400 },
      );
    }

    const content =
      typeof body.body === "string" ? body.body.trim() : "";
    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    if (
      !content ||
      content.length > 8000 ||
      (kind === "discussion" && (!title || title.length > 200))
    ) {
      return NextResponse.json(
        {
          error:
            "Enter valid content. Titles must be 1–200 characters and messages 1–8000 characters.",
        },
        { status: 400 },
      );
    }

    if (
      kind === "discussion" &&
      body.group_id != null &&
      (typeof body.group_id !== "string" ||
        !uuidPattern.test(body.group_id))
    ) {
      return NextResponse.json(
        { error: "Invalid discussion group." },
        { status: 400 },
      );
    }

    if (
      kind === "reply" &&
      (typeof body.discussion_id !== "string" ||
        !uuidPattern.test(body.discussion_id))
    ) {
      return NextResponse.json(
        { error: "Select a valid discussion before replying." },
        { status: 400 },
      );
    }

    const profiles = await getRows<{
      approval_status: string;
    }>(url, serviceKey, "profiles", {
      id: `eq.${authUser.id}`,
    });

    if (profiles[0]?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "An approved account is required to post." },
        { status: 403 },
      );
    }

    let groupId: string | null = null;

    if (kind === "discussion") {
      groupId = body.group_id ?? null;
    } else {
      const discussions = await getRows<{
        id: string;
        group_id: string | null;
      }>(url, serviceKey, "discussions", {
        id: `eq.${body.discussion_id}`,
      });

      if (!discussions.length) {
        return NextResponse.json(
          { error: "That discussion does not exist." },
          { status: 404 },
        );
      }

      groupId = discussions[0].group_id;
    }

    if (groupId) {
      const memberships = await getRows<{ group_id: string }>(
        url,
        serviceKey,
        "discussion_group_members",
        {
          group_id: `eq.${groupId}`,
          user_id: `eq.${authUser.id}`,
        },
      );

      if (!memberships.length) {
        return NextResponse.json(
          {
            error:
              "You must belong to this discussion group before posting.",
          },
          { status: 403 },
        );
      }
    }

    const decision = await moderate(
      kind === "discussion"
        ? `Discussion title: ${title}\n\n${content}`
        : content,
    );

    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, mode: decision.mode },
        { status: 422 },
      );
    }

    const table =
      kind === "discussion" ? "discussions" : "discussion_replies";

    const insertBody =
      kind === "discussion"
        ? {
            title,
            body: content,
            group_id: groupId,
            created_by: authUser.id,
          }
        : {
            discussion_id: body.discussion_id,
            body: content,
            created_by: authUser.id,
          };

    const insertResponse = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...serviceHeaders(serviceKey),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(insertBody),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      return NextResponse.json(
        {
          error:
            "The message passed moderation, but the database could not save it.",
        },
        { status: 400 },
      );
    }

    const records = (await insertResponse.json()) as Array<{ id: string }>;

    if (!records.length) {
      return NextResponse.json(
        { error: "The database did not confirm the saved message." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      record: records[0],
      mode: decision.mode,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MODERATION_UNAVAILABLE"
    ) {
      return NextResponse.json(
        {
          error:
            "Moderation is temporarily unavailable. Your message was not posted.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Posting could not complete. Please try again." },
      { status: 500 },
    );
  }
}
