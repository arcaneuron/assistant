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
  const [docText, setDocText] = useState<string>(`
Intro stuff, not relevant.

Email Comp: EOY URGENCY 12/30 7a MASS

Some text in between...

Email Comp: EOY FINAL STRETCH 12/30 9a MONTHLY

Another paragraph...

Email Comp: EOY FINAL STRETCH 12/30 7p LEADERSHIPHP

More random content...

Email Comp: EOY FINAL STRETCH 12/31 8a MAJOR
`.trim());

  const [imageText, setImageText] = useState<string>([
    "EOY_FS_Mass_12_30_7am.png",
    "EOY_FS_Monthly_12_30_9am.png",
    "EOY_FS_LeadershipHP_12_30_7pm.png",
    "EOY_FS_Major_12_31_8am.png",
  ].join("\n"));

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

    // Put filenames into the textarea
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
    <main className="min-h-screen bg-black text-white flex flex-col gap-6 p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-semibold">
        Email → Image Matcher Dev Console
      </h1>

      <p className="text-sm text-gray-300 max-w-2xl">
        Paste the Google Doc text (just the raw text for now) and the image filenames
        from the Box folder. Click <b>&quot;Run matcher&quot;</b> to see which
        <code>Email Comp</code> lines match which image filenames.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
  <label className="text-sm font-medium">
    Google Doc URL or ID
    <input
      className="mt-1 w-full rounded-md bg-zinc-900 border border-zinc-700 p-2 text-sm"
      placeholder="https://docs.google.com/document/d/..."
      value={docUrlOrId}
      onChange={(e) => setDocUrlOrId(e.target.value)}
    />
  </label>

  <button
    onClick={loadFromGoogleDoc}
    disabled={docLoading || !docUrlOrId.trim()}
    className="inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {docLoading ? "Loading from Google Docs..." : "Load doc text"}
  </button>

  <label className="text-sm font-medium mt-2">
    Document text (you can edit after loading)
    <textarea
      className="mt-1 w-full h-64 rounded-md bg-zinc-900 border border-zinc-700 p-2 text-sm"
      value={docText}
      onChange={(e) => setDocText(e.target.value)}
    />
  </label>
</div>


        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
  Box folder ID (optional)
  <input
    className="mt-1 w-full rounded-md bg-zinc-900 border border-zinc-700 p-2 text-sm"
    placeholder="e.g. 123456789"
    value={boxFolderId}
    onChange={(e) => setBoxFolderId(e.target.value)}
  />
</label>

<button
  onClick={loadImagesFromBox}
  disabled={boxLoading || !boxFolderId.trim()}
  className="mt-2 inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
>
  {boxLoading ? "Loading from Box..." : "Load image filenames from Box"}
</button>

<label className="text-sm font-medium mt-4">
  Image filenames (you can edit or paste manually)
  <textarea
    className="mt-1 w-full h-40 rounded-md bg-zinc-900 border border-zinc-700 p-2 text-sm"
    value={imageText}
    onChange={(e) => setImageText(e.target.value)}
  />
</label>

<button
  onClick={runMatcher}
  disabled={loading}
  className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
>
  {loading ? "Running matcher..." : "Run matcher"}
</button>


          {error && (
            <p className="text-sm text-red-400 mt-2">Error: {error}</p>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">Results</h2>
        {results.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No results yet. Run the matcher to see matches.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {results.map((r, idx) => (
              <li
                key={idx}
                className="border border-zinc-700 rounded-md p-3 bg-zinc-950"
              >
                <div className="font-mono text-xs text-zinc-400">
                  {r.line.originalLine}
                </div>
                {r.type === "single" && r.image && (
                  <div className="mt-1">
                    <span className="text-emerald-400 font-semibold">
                      ✅ Single match:
                    </span>{" "}
                    {r.image.name}
                    {r.image.url && (
                      <span className="text-zinc-400 text-xs">
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
                    <span className="text-yellow-300 font-semibold">
                      ⚠ Multiple possible matches:
                    </span>
                    <ul className="list-disc list-inside text-xs mt-1">
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
      <div className="mt-4 flex flex-col gap-2 max-w-md">
        <button
          onClick={applyLinksToDoc}
          disabled={
            applyLoading || !docUrlOrId.trim() || !boxFolderId.trim()
          }
          className="inline-flex items-center justify-center rounded-md bg-purple-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applyLoading
            ? "Applying links to Google Doc..."
            : "Apply links to Google Doc"}
        </button>

        {applyMessage && (
          <p className="text-sm text-emerald-400">
            {applyMessage}
          </p>
        )}
      </div>
    </main>
  );
}
