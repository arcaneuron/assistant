// email-image-matcher.js
// Local simulation: match "Email Comp" lines to image filenames

// 1) Sample data: lines from the Google Doc (we're simulating)
const emailLines = [
  "Email Comp: EOY URGENCY 12/30 7a MASS",
  "Email Comp: EOY FINAL STRETCH 12/30 9a MONTHLY",
  "Email Comp: EOY FINAL STRETCH 12/30 7p LEADERSHIPHP",
  "Email Comp: EOY FINAL STRETCH 12/31 8a MAJOR",
];

// 2) Sample data: image filenames from Box folder
const imageFilenames = [
  "EOY_FS_Mass_12_30_7am.png",
  "EOY_FS_Monthly_12_30_9am.png",
  "EOY_FS_LeadershipHP_12_30_7pm.png",
  "EOY_FS_Major_12_31_8am.png",
];

// Utility: normalize audience token from line into canonical form
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

// Utility: normalize "12/30" -> "12_30"
function normalizeDate(raw) {
  const t = raw.trim();
  // replace / or - with underscore
  return t.replace(/[/-]/g, "_");
}

// Utility: normalize "7a" -> "7am", "7pm" -> "7pm", "10a" -> "10am"
function normalizeTime(raw) {
  let t = raw.trim().toLowerCase();

  // Remove dots or spaces: "7 a" -> "7a"
  t = t.replace(/\s+/g, "");

  // If it already has "am" or "pm"
  if (t.endsWith("am") || t.endsWith("pm")) {
    return t;
  }

  // "7a" -> "7am", "9p" -> "9pm"
  if (t.endsWith("a")) {
    return t.slice(0, -1) + "am";
  }
  if (t.endsWith("p")) {
    return t.slice(0, -1) + "pm";
  }

  return t; // fallback
}

// Parse an "Email Comp" line into { date, time, audience }
function parseEmailCompLine(line) {
  const lower = line.toLowerCase();
  if (!lower.startsWith("email comp")) {
    return null;
  }

  // naive split by spaces after the colon
  const idx = line.indexOf(":");
  if (idx === -1) return null;

  const afterColon = line.slice(idx + 1).trim(); // "EOY URGENCY 12/30 7a MASS"
  const parts = afterColon.split(/\s+/);

  // We'll assume:
  // ... some words for campaign ... DATE TIME AUDIENCE
  // So we work backwards: last = audience, before that = time, before that = date
  if (parts.length < 3) return null;

  const audienceRaw = parts[parts.length - 1];     // "MASS"
  const timeRaw = parts[parts.length - 2];         // "7a"
  const dateRaw = parts[parts.length - 3];         // "12/30"

  const audience = normalizeAudience(audienceRaw);
  const dateNorm = normalizeDate(dateRaw);
  const timeNorm = normalizeTime(timeRaw);

  return {
    dateRaw,
    timeRaw,
    audienceRaw,
    dateNorm,   // "12_30"
    timeNorm,   // "7am"
    audience,   // "Mass"
  };
}

// Try to find best matching filename for a parsed line
function findMatchingImage(parsed, filenames) {
  const dateToken = parsed.dateNorm;     // e.g. "12_30"
  const timeToken = parsed.timeNorm;     // e.g. "7am"
  const audienceToken = parsed.audience; // e.g. "Mass"

  const candidates = filenames.filter((name) => {
    const lc = name.toLowerCase();

    // date: allow "12_30" or "12-30"
    const dateOk =
      lc.includes(dateToken) ||
      lc.includes(dateToken.replace(/_/g, "-"));

    // time: allow "7am" or "7a"
    const timeOk =
      lc.includes(timeToken) ||
      lc.includes(timeToken.replace("am", "a").replace("pm", "p"));

    // audience: case-insensitive, handle HP combos
    const audLc = audienceToken.toLowerCase(); // "mass", "leadershiphp"
    const audienceOk = lc.includes(audLc);

    return dateOk && timeOk && audienceOk;
  });

  if (candidates.length === 1) {
    return {
      type: "single",
      filename: candidates[0],
    };
  }

  if (candidates.length === 0) {
    return {
      type: "none",
      message: "No matching image found",
    };
  }

  return {
    type: "multiple",
    filenames: candidates,
  };
}

// Run the simulation
function run() {
  console.log("=== Email Comp line -> image filename matcher ===\n");

  for (const line of emailLines) {
    console.log(`Line: ${line}`);

    const parsed = parseEmailCompLine(line);
    if (!parsed) {
      console.log("  Could not parse line.\n");
      continue;
    }

    console.log(
      `  Parsed -> date: ${parsed.dateNorm}, time: ${parsed.timeNorm}, audience: ${parsed.audience}`
    );

    const match = findMatchingImage(parsed, imageFilenames);

    if (match.type === "single") {
      console.log(`  ✅ Match: ${match.filename}\n`);
    } else if (match.type === "none") {
      console.log(`  ❌ No match found for this line.\n`);
    } else {
      console.log(
        `  ⚠ Multiple possible matches: ${match.filenames.join(", ")}\n`
      );
    }
  }
}

run();
