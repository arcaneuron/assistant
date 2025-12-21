// app/api/ai-helper/route.ts
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

if (!DEEPSEEK_API_KEY) {
  console.warn("DEEPSEEK_API_KEY is not set");
}

type AiHelperRequest = {
  lineText: string;              // the "Email Comp: ..." line
  contextLine?: string;          // line above, e.g. "12/31 EOY Match Impact"
  candidates: { name: string }[]; // filenames
};

export async function POST(req: NextRequest) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: AiHelperRequest;
  try {
    body = (await req.json()) as AiHelperRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lineText, contextLine, candidates } = body;

  if (!lineText || !candidates || candidates.length === 0) {
    return NextResponse.json(
      { error: "Missing lineText or candidates" },
      { status: 400 }
    );
  }

  // Build a compact prompt to minimize tokens
  const candidateList = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");

  const userContent = `
You help a project manager match "Email Comp" lines from a Google Doc to the correct image filenames.

Rules:
- Date/time in the document must match the date/time in the filename.
- The audience word in the line (e.g. Mass, Leadership, Monthly, Major, MassHP, LeadershipHP) must match the audience in the filename.
- Extra words like "Impact" or "Urgency" near the date line also appear in the filename and must match when present.
- If there is no clearly correct filename, answer with "NONE".

Document context:
- Email line: "${lineText}"
- Extra context line (may be empty): "${contextLine || ""}"

Candidate filenames:
${candidateList}

Respond with a single line in this exact JSON format:
{"choice": "<exact filename or NONE>", "reason": "<short explanation>"}
`.trim();

  try {
    const dsRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a precise matching engine. Always follow the rules exactly. Never hallucinate filenames.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0,
        max_tokens: 128,
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text().catch(() => "");
      return NextResponse.json(
        { error: "DeepSeek API error", details: errText.slice(0, 500) },
        { status: 500 }
      );
    }

    const json = (await dsRes.json()) as any;
    const raw = json.choices?.[0]?.message?.content?.trim() || "";

    let parsed: { choice: string; reason?: string } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback: try to extract filename between quotes
      const m = raw.match(/"choice"\s*:\s*"([^"]+)"/);
      if (m) {
        parsed = { choice: m[1] };
      }
    }

    if (!parsed || !parsed.choice) {
      return NextResponse.json(
        { error: "Could not parse AI response", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({
      choice: parsed.choice,
      reason: parsed.reason ?? null,
      raw,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to call DeepSeek", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
