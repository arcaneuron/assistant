// app/meeting/page.tsx
"use client";

import { useState } from "react";

type Task = {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
};

export default function MeetingPage() {
  const [transcript, setTranscript] = useState("");
  const [account, setAccount] = useState<"A" | "B">("A");
  const [projectName, setProjectName] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [styleProfile, setStyleProfile] = useState("");

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSummary(null);
    setTasks([]);
    setEmailDraft(null);

    try {
      const res = await fetch("/api/process-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          account,
          projectName,
          meetingTitle,
          meetingDate,
          styleProfile,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      const data = await res.json();
      setSummary(data.summary || null);
      setTasks(data.tasks || []);
      setEmailDraft(data.followup_email_draft || null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-slate-950 text-slate-100">
      <h1 className="text-2xl md:text-3xl font-semibold">
        Meeting to Tasks Assistant
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 md:grid-cols-2 bg-slate-900 rounded-xl p-4 md:p-6"
      >
        <div className="flex flex-col gap-3 md:col-span-2">
          <label className="text-sm font-medium">
            Transcript
            <textarea
              className="mt-1 w-full h-48 rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              placeholder="Paste the meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Account
            <select
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              value={account}
              onChange={(e) => setAccount(e.target.value as "A" | "B")}
            >
              <option value="A">Account A</option>
              <option value="B">Account B</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Project Name
            <input
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              placeholder="Website Redesign for Client X"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </label>

          <label className="text-sm font-medium">
            Meeting Title
            <input
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              placeholder="Weekly sync with Client X"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </label>

          <label className="text-sm font-medium">
            Meeting Date
            <input
              type="date"
              className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Style Profile (optional)
            <textarea
              className="mt-1 w-full h-40 rounded-md bg-slate-950 border border-slate-700 p-2 text-sm"
              placeholder="Paste a few example emails or your style guide here..."
              value={styleProfile}
              onChange={(e) => setStyleProfile(e.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={loading || !transcript}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Process Meeting"}
          </button>

          {error && (
            <p className="text-sm text-red-400 mt-2">Error: {error}</p>
          )}
        </div>
      </form>

      {/* Results */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-900 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          {summary ? (
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Process a meeting to see the summary here.
            </p>
          )}
        </div>

        <div className="bg-slate-900 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Tasks</h2>
          {tasks.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {tasks.map((t, idx) => (
                <li
                  key={idx}
                  className="border border-slate-700 rounded-md p-2"
                >
                  <div className="font-medium">{t.title}</div>
                  {t.description && (
                    <div className="text-slate-300 text-xs mt-1">
                      {t.description}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    Priority: {t.priority}
                    {t.due_date && ` • Due: ${t.due_date}`}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              No tasks yet. They will appear here after processing.
            </p>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">Follow up email draft</h2>
        {emailDraft ? (
          <pre className="text-sm whitespace-pre-wrap">
            {emailDraft}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">
            The draft follow up email will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
