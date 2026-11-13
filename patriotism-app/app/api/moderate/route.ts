import { NextResponse } from "next/server";
import {
  checkRateLimit,
  readJsonSafely,
} from "@/lib/api-protection";


function basicSafetyCheck(content: string) {
  const threatPattern =
    /\b(i will|i'll|im going to|i am going to|we will|we're going to)\s+(kill|hurt|attack|shoot|burn)\b/i;

  const urls = content.match(/https?:\/\/\S+/gi) ?? [];

  if (threatPattern.test(content)) {
    return {
      allowed: false,
      message:
        "This message appears to contain a threat. Please rewrite it respectfully.",
    };
  }

  if (urls.length >= 4) {
    return {
      allowed: false,
      message:
        "This message contains too many links and may be spam. Please review it.",
    };
  }

  return { allowed: true, message: "" };
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Server authentication is not configured." },
        { status: 500 },
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
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

    const profileUrl = new URL("/rest/v1/profiles", supabaseUrl);
    profileUrl.searchParams.set("select", "approval_status");
    profileUrl.searchParams.set("id", `eq.${authUser.id}`);

    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: "Unable to verify account approval." },
        { status: 503 },
      );
    }

    const profiles = (await profileResponse.json()) as Array<{
      approval_status?: string;
    }>;

    if (profiles[0]?.approval_status !== "approved") {
      return NextResponse.json(
        { error: "An approved account is required to post." },
        { status: 403 },
      );
    }

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

    const body = parsed.value as { content?: unknown };
    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    if (!content || content.length > 8000) {
      return NextResponse.json(
        { error: "Message content must be between 1 and 8000 characters." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ...basicSafetyCheck(content),
        mode: "rules",
      });
    }

    const moderationResponse = await fetch(
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

    if (!moderationResponse.ok) {
      return NextResponse.json(
        {
          error:
            "AI moderation is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }

    const result = (await moderationResponse.json()) as {
      results?: Array<{ flagged?: boolean }>;
    };

    if (!result.results?.length) {
      return NextResponse.json(
        { error: "The moderation service returned no decision. Please retry." },
        { status: 503 },
      );
    }

    const flagged = result.results[0].flagged === true;

    return NextResponse.json({
      allowed: !flagged,
      message: flagged
        ? "This message was flagged by the safety check. Please revise it or contact an administrator if you believe this is a mistake."
        : "",
      mode: "ai",
    });
  } catch {
    return NextResponse.json(
      { error: "Moderation could not complete. Please try again." },
      { status: 500 },
    );
  }
}
