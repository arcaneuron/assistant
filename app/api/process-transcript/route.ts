// app/api/process-transcript/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const FIXED_USER_ID = process.env.PM_TWIN_USER_ID || "pm-user-1";

export async function POST(req: NextRequest) {
  try {
    const {
      transcript,
      account,
      projectName,
      meetingTitle,
      meetingDate,
      styleProfile,
    } = await req.json();

    if (!transcript || !account) {
      return NextResponse.json(
        { error: "Missing transcript or account" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You help a project manager extract structured information from meeting transcripts.

Return a single JSON object with this shape:

{
  "summary": string,
  "tasks": [
    {
      "title": string,
      "description": string,
      "due_date": string | null,  // YYYY-MM-DD or null
      "priority": "low" | "medium" | "high"
    }
  ],
  "followup_email_draft": string
}

Rules:
- Only include tasks that the project manager herself needs to handle or track.
- If you do not know a due date, set "due_date" to null.
- If a task is clearly urgent or time bound, set "priority" to "high".
`.trim();

    const userContent = `
ACCOUNT: ${account}
PROJECT NAME: ${projectName || "Unspecified"}
MEETING TITLE: ${meetingTitle || "Unspecified"}
MEETING DATE: ${meetingDate || "Unspecified"}

STYLE PROFILE (may be empty):
${styleProfile || "(no style profile provided)"}

TRANSCRIPT:
${transcript}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const jsonText = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(jsonText) as {
      summary: string;
      tasks: {
        title: string;
        description?: string;
        due_date: string | null;
        priority: "low" | "medium" | "high";
      }[];
      followup_email_draft: string;
    };

    // 1) find or create project
    let projectId: string | null = null;

    if (projectName) {
      const { data: existing, error: projectError } = await supabaseServer
        .from("projects")
        .select("id")
        .eq("user_id", FIXED_USER_ID)
        .eq("name", projectName)
        .eq("account", account)
        .maybeSingle();

      if (projectError) {
        console.error("Error checking project:", projectError);
      }

      if (existing) {
        projectId = existing.id;
      } else {
        const { data: inserted, error: insertError } = await supabaseServer
          .from("projects")
          .insert({
            user_id: FIXED_USER_ID,
            name: projectName,
            account,
            status: "active",
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Error inserting project:", insertError);
        } else if (inserted) {
          projectId = inserted.id;
        }
      }
    }

    // 2) insert meeting
    const { data: meeting, error: meetingError } = await supabaseServer
      .from("meetings")
      .insert({
        user_id: FIXED_USER_ID,
        project_id: projectId,
        account,
        title: meetingTitle || "Meeting",
        meeting_date: meetingDate || null,
        raw_transcript: transcript,
        ai_summary: parsed.summary,
        followup_email_draft: parsed.followup_email_draft,
      })
      .select("id")
      .single();

    if (meetingError || !meeting) {
      console.error("Error inserting meeting:", meetingError);
      return NextResponse.json(
        { error: "Failed to save meeting" },
        { status: 500 }
      );
    }

    const meetingId = meeting.id;

    // 3) insert tasks
    const taskRows =
      parsed.tasks?.map((t) => ({
        user_id: FIXED_USER_ID,
        project_id: projectId,
        meeting_id: meetingId,
        account,
        title: t.title,
        description: t.description || null,
        priority: t.priority || "medium",
        due_date: t.due_date || null,
        status: "todo",
      })) || [];

    if (taskRows.length > 0) {
      const { error: tasksError } = await supabaseServer
        .from("tasks")
        .insert(taskRows);

      if (tasksError) {
        console.error("Error inserting tasks:", tasksError);
      }
    }

    return NextResponse.json({
      meetingId,
      projectId,
      summary: parsed.summary,
      tasks: taskRows,
      followup_email_draft: parsed.followup_email_draft,
    });
  } catch (err: any) {
    console.error("process-transcript error:", err?.message || err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
