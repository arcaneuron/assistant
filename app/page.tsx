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

  const hasDoc = !!docText.trim();
  const hasBox = !!imageText.trim();
  const hasResults = results.length > 0;

  return (
    <main className="app-shell">
      {/* Top bar */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-logo">PM</div>
            <div className="app-title">
              <span className="app-title-main">
                PM Twin · Email → Image Linker
              </span>
              <span className="app-title-sub">
                Auto-link Box images into your Google Doc email comps.
              </span>
            </div>
          </div>

          <div className="app-status-row">
            <div
              className={
                "status-chip " + (hasDoc ? "status-chip--green" : "")
              }
            >
              Doc&nbsp;
              <span>{hasDoc ? "READY" : "PENDING"}</span>
            </div>
            <div
              className={
                "status-chip " + (hasBox ? "status-chip--blue" : "")
              }
            >
              Box&nbsp;
              <span>{hasBox ? "READY" : "PENDING"}</span>
            </div>
            <div
              className={
                "status-chip " + (hasResults ? "status-chip--violet" : "")
              }
            >
              Matches&nbsp;
              <span>{hasResults ? "OK" : "WAIT"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Intro */}
        <section className="intro">
          <p>
            Paste a Google Doc and a Box folder. PM Twin will read the email
            comps, match each <code>Email Comp</code> line to the correct image
            filename, and can push hyperlinks back into the Google Doc for you.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Main grid */}
        <section className="layout-grid">
          {/* Left column: Google Doc */}
          <div className="card">
            <h2>
              <span>1 · Google Doc</span>
            </h2>

            <div className="field">
              <label className="field-label">Google Doc URL or ID</label>
              <input
                className="input"
                placeholder="https://docs.google.com/document/d/..."
                value={docUrlOrId}
                onChange={(e) => setDocUrlOrId(e.target.value)}
              />
            </div>

            <div className="button-row">
              <button
                onClick={loadFromGoogleDoc}
                disabled={docLoading || !docUrlOrId.trim()}
                className="btn btn-primary"
              >
                {docLoading
                  ? "Loading from Google Docs…"
                  : "Load doc text"}
              </button>
            </div>

            <div className="field">
              <label className="field-label">
                Document text (editable preview)
              </label>
              <textarea
                className="textarea"
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />
            </div>
          </div>

          {/* Right column: Box */}
          <div className="card">
            <h2>
              <span>2 · Box folder & images</span>
            </h2>

            <div className="field">
              <label className="field-label">Box folder ID</label>
              <input
                className="input"
                placeholder="e.g. 123456789"
                value={boxFolderId}
                onChange={(e) => setBoxFolderId(e.target.value)}
              />
            </div>

            <div className="button-row">
              <button
                onClick={loadImagesFromBox}
                disabled={boxLoading || !boxFolderId.trim()}
                className="btn btn-secondary"
              >
                {boxLoading
                  ? "Loading image filenames from Box…"
                  : "Load image filenames from Box"}
              </button>
            </div>

            <div className="field">
              <label className="field-label">Image filenames (editable)</label>
              <textarea
                className="textarea"
                value={imageText}
                onChange={(e) => setImageText(e.target.value)}
              />
            </div>

            <div className="button-row">
              <button
                onClick={runMatcher}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "Running matcher…" : "Run matcher"}
              </button>
            </div>
          </div>
        </section>

        {/* Results + apply */}
        <section className="results-section">
          <div className="results-card">
            <div className="results-header">
              <div className="results-title">3 · Matcher results</div>
              <div className="results-pill">
                {results.length === 0
                  ? "No results yet"
                  : `${results.length} line(s) processed`}
              </div>
            </div>

            {results.length === 0 ? (
              <p className="results-empty">
                Run the matcher to see which <code>Email Comp</code> lines match
                which filenames.
              </p>
            ) : (
              <ul className="results-list">
                {results.map((r, idx) => (
                  <li key={idx} className="result-item">
                    <div className="result-line">
                      {r.line.originalLine}
                    </div>

                    {r.type === "single" && r.image && (
                      <div className="result-success">
                        <span>✅ Single match:</span> {r.image.name}
                      </div>
                    )}

                    {r.type === "none" && (
                      <div className="result-error">
                        ❌ No image match found for this line.
                      </div>
                    )}

                    {r.type === "multiple" && r.images && (
                      <div className="result-multi">
                        ⚠ Multiple possible matches:
                        <ul>
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

          <div className="apply-row">
            <button
              onClick={applyLinksToDoc}
              disabled={
                applyLoading || !docUrlOrId.trim() || !boxFolderId.trim()
              }
              className="btn btn-primary"
            >
              {applyLoading
                ? "Applying links to Google Doc…"
                : "Apply links to Google Doc"}
            </button>

            {applyMessage && (
              <p className="apply-message">{applyMessage}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
