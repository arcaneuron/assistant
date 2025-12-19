"use client";

import { useState } from "react";

type ApiMatchResult = {
  type: "single" | "none" | "multiple";
  line: {
    originalLine: string;
    dateNorm?: string;
    timeNorm?: string;
    audience?: string;
    [key: string]: any;
  };
  image?: { name: string; url?: string };
  images?: { name: string; url?: string }[];
};

export default function HomePage() {
  const [docText, setDocText] = useState<string>(
    `
Intro stuff, not relevant.

Email Comp: EOY URGENCY 12/30 7a MASS

Some text in between...

Email Comp: EOY FINAL STRETCH 12/30 9a MONTHLY

Another paragraph...

Email Comp: EOY FINAL STRETCH 12/30 7p LEADERSHIPHP

More random content...

Email Comp: EOY FINAL STRETCH 12/31 8a MAJOR
`.trim()
  );

  const [imageText, setImageText] = useState<string>(
    [
      "EOY_FS_Mass_12_30_7am.png",
      "EOY_FS_Monthly_12_30_9am.png",
      "EOY_FS_LeadershipHP_12_30_7pm.png",
      "EOY_FS_Major_12_31_8am.png",
    ].join("\n")
  );

  const [results, setResults] = useState<ApiMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [boxFolderId, setBoxFolderId] = useState<string>("");
  const [boxLoading, setBoxLoading] = useState(false);

  const [docUrlOrId, setDocUrlOrId] = useState<string>("");
  const [docLoading, setDocLoading] = useState(false);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const applyLinksToDoc = async () => {
    if (!docUrlOrId.trim() || !boxFolderId.trim()) {
      setError("Please enter both a Google Doc URL/ID and a Box folder ID.");
      return;
    }

    setApplyLoading(true);
    setApplyMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/apply-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docUrlOrId: docUrlOrId.trim(),
          folderId: boxFolderId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to apply links");
      }

      setApplyMessage(
        data.message ||
          `Applied ${data.updated || 0} hyperlink(s) to the document.`
      );
    } catch (err: any) {
      setError(err.message || "Error applying links to Google Doc");
    } finally {
      setApplyLoading(false);
    }
  };

  const loadFromGoogleDoc = async () => {
    if (!docUrlOrId.trim()) {
      setError("Please enter a Google Doc URL or ID.");
      return;
    }

    setDocLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/google-doc-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docUrlOrId: docUrlOrId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load Google Doc");
      }

      const data = await res.json();
      setDocText(data.text || "");
    } catch (err: any) {
      setError(err.message || "Error loading Google Doc");
    } finally {
      setDocLoading(false);
    }
  };

  const loadImagesFromBox = async () => {
    if (!boxFolderId.trim()) {
      setError("Please enter a Box folder ID.");
      return;
    }

    setBoxLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/box-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: boxFolderId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load images from Box");
      }

      const data = await res.json();
      const images = data.images || [];

      if (images.length === 0) {
        setError("No image files found in that Box folder.");
        return;
      }

      setImageText(images.map((img: any) => img.name).join("\n"));
    } catch (err: any) {
      setError(err.message || "Error loading images from Box");
    } finally {
      setBoxLoading(false);
    }
  };

  const runMatcher = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const filenames = imageText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const res = await fetch("/api/test-matcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docText,
          images: filenames,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs font-medium text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              PM Twin · Email → Image Linker
            </div>
            <h1 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
              Email → Image Matcher Dev Console
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-xl">
              Paste a Google Doc and a Box folder. The app finds the right image
              for each <code className="rounded bg-zinc-800 px-1">Email Comp</code>{" "}
              line and can auto-link them back into the doc.
            </p>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Main grid */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Left column: sources + doc text */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3">
                1 · Google Doc
              </h2>
              <label className="text-xs font-medium text-zinc-300">
                Google Doc URL or ID
                <input
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none ring-0 focus:border-sky-400"
                  placeholder="https://docs.google.com/document/d/..."
                  value={docUrlOrId}
                  onChange={(e) => setDocUrlOrId(e.target.value)}
                />
              </label>

              <button
                onClick={loadFromGoogleDoc}
                disabled={docLoading || !docUrlOrId.trim()}
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {docLoading ? "Loading from Google Docs..." : "Load doc text"}
              </button>

              <label className="mt-4 block text-xs font-medium text-zinc-300">
                Document text (editable preview)
                <textarea
                  className="mt-1 h-64 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none ring-0 focus:border-emerald-400"
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Right column: Box + image names + run matcher */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3">
                2 · Box folder & images
              </h2>

              <label className="text-xs font-medium text-zinc-300">
                Box folder ID
                <input
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none ring-0 focus:border-sky-400"
                  placeholder="e.g. 123456789"
                  value={boxFolderId}
                  onChange={(e) => setBoxFolderId(e.target.value)}
                />
              </label>

              <button
                onClick={loadImagesFromBox}
                disabled={boxLoading || !boxFolderId.trim()}
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {boxLoading
                  ? "Loading image filenames from Box..."
                  : "Load image filenames from Box"}
              </button>

              <label className="mt-4 block text-xs font-medium text-zinc-300">
                Image filenames (editable)
                <textarea
                  className="mt-1 h-40 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none ring-0 focus:border-emerald-400"
                  value={imageText}
                  onChange={(e) => setImageText(e.target.value)}
                />
              </label>

              <button
                onClick={runMatcher}
                disabled={loading}
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Running matcher..." : "Run matcher"}
              </button>
            </div>
          </div>
        </section>

        {/* Results + apply */}
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                3 · Matcher results
              </h2>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                {results.length === 0
                  ? "No results yet"
                  : `${results.length} line(s) processed`}
              </span>
            </div>

            {results.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400">
                Run the matcher to see which{" "}
                <code className="rounded bg-zinc-800 px-1">Email Comp</code>{" "}
                lines match which filenames.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-xs">
                {results.map((r, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <div className="font-mono text-[11px] text-zinc-400">
                      {r.line.originalLine}
                    </div>

                    {r.type === "single" && r.image && (
                      <div className="mt-1">
                        <span className="font-semibold text-emerald-400">
                          ✅ Single match:
                        </span>{" "}
                        {r.image.name}
                        {r.image.url && (
                          <span className="text-[10px] text-zinc-500">
                            {" "}
                            ({r.image.url})
                          </span>
                        )}
                      </div>
                    )}

                    {r.type === "none" && (
                      <div className="mt-1 text-red-400">
                        ❌ No image match found for this line.
                      </div>
                    )}

                    {r.type === "multiple" && r.images && (
                      <div className="mt-1">
                        <span className="font-semibold text-yellow-300">
                          ⚠ Multiple possible matches:
                        </span>
                        <ul className="mt-1 list-inside list-disc text-[11px] text-zinc-300">
                          {r.images.map((img, i) => (
                            <li key={i}>{img.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button
              onClick={applyLinksToDoc}
              disabled={
                applyLoading || !docUrlOrId.trim() || !boxFolderId.trim()
              }
              className="inline-flex w-full items-center justify-center rounded-md bg-purple-500 px-4 py-2 text-xs font-medium text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {applyLoading
                ? "Applying links to Google Doc..."
                : "Apply links to Google Doc"}
            </button>

            {applyMessage && (
              <p className="text-xs text-emerald-300">{applyMessage}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
