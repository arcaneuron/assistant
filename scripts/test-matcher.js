// scripts/test-matcher.js
// Local simulation: match "Email Comp" lines to image filenames (plain JS)

// ---------- Matching brain ----------

// Normalize audience token
function normalizeAudience(raw) {
  const t = raw.trim().toLowerCase();

  if (t === "mass") return "Mass";
  if (t === "monthly") return "Monthly";
  if (t === "leadership") return "Leadership";
  if (t === "masshp" || t === "mass_hp") return "MassHP";
  if (t === "leadershiphp" || t === "leadership_hp") return "LeadershipHP";
  if (t === "major") return "Major";

  // fallback: Capitalize first letter
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

// "12/30" -> "12_30"
function normalizeDate(raw) {
  const t = raw.trim();
  return t.replace(/[/-]/g, "_");
}

// "7a" -> "7am", "7pm" -> "7pm"
function normalizeTime(raw) {
  let t = raw.trim().toLowerCase();
  t = t.replace(/\s+/g, "");

  if (t.endsWith("am") || t.endsWith("pm")) return t;

  if (t.endsWith("a")) return t.slice(0, -1) + "am";
  if (t.endsWith("p")) return t.slice(0, -1) + "pm";

  return t;
}

/**
 * Parse an "Email Comp" line into structured data.
 * Assumes format:
 *   "Email Comp: ... DATE TIME AUDIENCE"
 */
function parseEmailCompLine(line) {
  const lower = line.toLowerCase();
  if (!lower.startsWith("email comp")) return null;

  const idx = line.indexOf(":");
  if (idx === -1) return null;

  const afterColon = line.slice(idx + 1).trim();
  const parts = afterColon.split(/\s+/);

  if (parts.length < 3) return null;

  const audienceRaw = parts[parts.length - 1];
  const timeRaw = parts[parts.length - 2];
  const dateRaw = parts[parts.length - 3];

  const audience = normalizeAudience(audienceRaw);
  const dateNorm = normalizeDate(dateRaw);
  const timeNorm = normalizeTime(timeRaw);

  return {
    originalLine: line,
    dateRaw,
    timeRaw,
    audienceRaw,
    dateNorm,   // "12_30"
    timeNorm,   // "7am"
    audience,   // "Mass"
  };
}

/**
 * Find best matching image filename for one parsed line.
 */
function findMatchingImage(parsed, images) {
  const dateToken = parsed.dateNorm;     // "12_30"
  const timeToken = parsed.timeNorm;     // "7am"
  const audienceToken = parsed.audience; // "Mass"

  const candidates = images.filter((img) => {
    const nameLc = img.name.toLowerCase();

    // date: allow "12_30" or "12-30"
    const dateOk =
      nameLc.includes(dateToken) ||
      nameLc.includes(dateToken.replace(/_/g, "-"));

    // time: allow "7am" or "7a"
    const timeOk =
      nameLc.includes(timeToken) ||
      nameLc.includes(timeToken.replace("am", "a").replace("pm", "p"));

    // audience
    const audLc = audienceToken.toLowerCase();
    const audienceOk = nameLc.includes(audLc);

    return dateOk && timeOk && audienceOk;
  });

  if (candidates.length === 1) {
    return {
      type: "single",
      line: parsed,
      image: candidates[0],
    };
  }

  if (candidates.length === 0) {
    return {
      type: "none",
      line: parsed,
      reason: "No matching image found",
    };
  }

  return {
    type: "multiple",
    line: parsed,
    images: candidates,
  };
}

/**
 * Given a whole document text and list of image files,
 * returns match results for every "Email Comp" line found.
 */
function matchEmailLinesToImages(docText, images) {
  const lines = docText.split(/\r?\n/);
  const results = [];

  for (const line of lines) {
    const parsed = parseEmailCompLine(line);
    if (!parsed) continue;

    const match = findMatchingImage(parsed, images);
    results.push(match);
  }

  return results;
}

// ---------- Test data ----------

const fakeDocText = `
Intro stuff, not relevant.

Email Comp: EOY URGENCY 12/30 7a MASS

Some text in between...

Email Comp: EOY FINAL STRETCH 12/30 9a MONTHLY

Another paragraph...

Email Comp: EOY FINAL STRETCH 12/30 7p LEADERSHIPHP

More random content...

Email Comp: EOY FINAL STRETCH 12/31 8a MAJOR
`;

const imageFiles = [
  { name: "EOY_FS_Mass_12_30_7am.png", url: "https://box.com/file/mass-7am" },
  {
    name: "EOY_FS_Monthly_12_30_9am.png",
    url: "https://box.com/file/monthly-9am",
  },
  {
    name: "EOY_FS_LeadershipHP_12_30_7pm.png",
    url: "https://box.com/file/leadershiphp-7pm",
  },
  { name: "EOY_FS_Major_12_31_8am.png", url: "https://box.com/file/major-8am" },
];

// ---------- Run test ----------

const results = matchEmailLinesToImages(fakeDocText, imageFiles);

console.log("=== Matching results ===\n");
for (const r of results) {
  console.log(`Line: ${r.line.originalLine}`);
  if (r.type === "single") {
    console.log(`  ✅ Matched image: ${r.image.name} (${r.image.url})\n`);
  } else if (r.type === "none") {
    console.log(`  ❌ No match: ${r.reason}\n`);
  } else {
    console.log(
      `  ⚠ Multiple matches: ${r.images.map((i) => i.name).join(", ")}\n`
    );
  }
}
