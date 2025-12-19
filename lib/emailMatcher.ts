// lib/emailMatcher.ts

export type ParsedEmailComp = {
  originalLine: string;
  lineIndex: number;

  // Raw tokens we detected (may be empty if not present)
  dateRaw?: string;
  timeRaw?: string;
  audienceRaw: string;
  variantRaw?: string;      // e.g. "Impact", "Urgency"

  // Normalized
  dateNorm?: string;        // "12_31"
  timeNorm?: string;        // "7am"
  audience: string;         // "Mass", "Leadership", etc.
  variantNorm?: string;     // "impact", "urgency"

  // Which [LINK] this segment is associated with in the line (0, 1, 2, ...)
  linkIndexInLine?: number;
};

export type ImageFile = {
  name: string;             // e.g. "EOY_FS_Mass_12.31_Impact.png"
  url?: string;             // Box share URL (if we have it)
};

export type MatchResult =
  | {
      type: "single";
      line: ParsedEmailComp;
      image: ImageFile;
    }
  | {
      type: "none";
      line: ParsedEmailComp;
      reason: string;
    }
  | {
      type: "multiple";
      line: ParsedEmailComp;
      images: ImageFile[];
    };

// ---------- helpers ----------

const KNOWN_AUDIENCES = [
  "mass",
  "monthly",
  "leadership",
  "masshp",
  "leadershiphp",
  "major",
];

function isDateToken(raw: string): boolean {
  const t = raw.trim();
  // e.g. 12/31, 12-31, 12_31, 12.31
  return /^\d{1,2}[\/._-]\d{1,2}$/.test(t);
}

function isTimeToken(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  // e.g. 7a, 7am, 7:00am, 7:00p, 7pm
  return /^\d{1,2}(:\d{2})?(a|p|am|pm)$/.test(t);
}

function isLinkToken(raw: string): boolean {
  return raw.trim().toUpperCase() === "[LINK]";
}

function isAudienceToken(raw: string): boolean {
  return KNOWN_AUDIENCES.includes(raw.trim().toLowerCase());
}

// Normalize audience token
export function normalizeAudience(raw: string): string {
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

// "12/31" or "12-31" or "12.31" -> "12_31"
export function normalizeDate(raw: string): string {
  const t = raw.trim();
  return t.replace(/[\/.-]/g, "_");
}

// "7a" -> "7am", "7pm" stays "7pm"
export function normalizeTime(raw: string): string {
  let t = raw.trim().toLowerCase();
  t = t.replace(/\s+/g, "");

  if (t.endsWith("am") || t.endsWith("pm")) return t;

  if (t.endsWith("a")) return t.slice(0, -1) + "am";
  if (t.endsWith("p")) return t.slice(0, -1) + "pm";

  return t;
}

// ---------- parsing of a single Email Comp line ----------

/**
 * Parses a single "Email Comp" line into one or more segments.
 *
 * Supports:
 *  - New style: "Email Comp: Mass [LINK] Leadership [LINK]"
 *      -> segments for (Mass, link 0) and (Leadership, link 1)
 *
 *  - Old style: "Email Comp: [LINK] Mass [LINK] Leadership"
 *      -> segments for (Mass, link 0) and (Leadership, link 1)
 *
 *  - Legacy fallback: "Email Comp: ... 12/31 7a MASS"
 *      -> single segment with date/time/audience
 *
 * Date/variant can also be supplied from previous line (context); see parseDocument().
 */
function parseLineToSegments(
  line: string,
  lineIndex: number
): ParsedEmailComp[] {
  const lower = line.toLowerCase();
  if (!lower.startsWith("email comp")) return [];

  const idx = line.indexOf(":");
  if (idx === -1) return [];

  const afterColon = line.slice(idx + 1).trim();
  if (!afterColon) return [];

  const tokens = afterColon.split(/\s+/); // everything after "Email Comp:"

  // 1) Detect date/time tokens inside this line (if present)
  let dateRaw: string | undefined;
  let timeRaw: string | undefined;

  for (const tok of tokens) {
    if (!dateRaw && isDateToken(tok)) {
      dateRaw = tok;
    } else if (!timeRaw && isTimeToken(tok)) {
      timeRaw = tok;
    }
  }

  const dateNorm = dateRaw ? normalizeDate(dateRaw) : undefined;
  const timeNorm = timeRaw ? normalizeTime(timeRaw) : undefined;

  // 2) Find audience + [LINK] pairs and [LINK] + audience pairs
  const segments: ParsedEmailComp[] = [];
  let linkCounter = 0; // logical [LINK] index from left to right

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];

    // Count any [LINK] token so linkIndexInLine stays aligned
    if (isLinkToken(current)) {
      linkCounter++;
      continue;
    }

    // Pattern A (new): Audience [LINK]
    if (isAudienceToken(current) && next && isLinkToken(next)) {
      const audience = normalizeAudience(current);

      segments.push({
        originalLine: line,
        lineIndex,
        dateRaw,
        timeRaw,
        audienceRaw: current,
        dateNorm,
        timeNorm,
        audience,
        linkIndexInLine: linkCounter,
      });

      linkCounter++;
      i++; // skip the [LINK]
      continue;
    }

    // Pattern B (old): [LINK] Audience
    if (isLinkToken(current) && next && isAudienceToken(next)) {
      const audience = normalizeAudience(next);

      segments.push({
        originalLine: line,
        lineIndex,
        dateRaw,
        timeRaw,
        audienceRaw: next,
        dateNorm,
        timeNorm,
        audience,
        linkIndexInLine: linkCounter,
      });

      linkCounter++;
      i++; // skip the audience token
      continue;
    }
  }

  if (segments.length > 0) {
    return segments;
  }

  // 3) Fallback: old style "Email Comp: ... DATE TIME AUDIENCE"
  if (tokens.length < 3) return [];

  const audienceRaw = tokens[tokens.length - 1];
  const timeRawFallback = tokens[tokens.length - 2];
  const dateRawFallback = tokens[tokens.length - 3];

  const audience = normalizeAudience(audienceRaw);
  const dateNormFallback = isDateToken(dateRawFallback)
    ? normalizeDate(dateRawFallback)
    : dateNorm;
  const timeNormFallback = isTimeToken(timeRawFallback)
    ? normalizeTime(timeRawFallback)
    : timeNorm;

  return [
    {
      originalLine: line,
      lineIndex,
      dateRaw: dateRawFallback,
      timeRaw: timeRawFallback,
      audienceRaw,
      dateNorm: dateNormFallback,
      timeNorm: timeNormFallback,
      audience,
      linkIndexInLine: 0,
    },
  ];
}

// ---------- parsing the whole document with DATE + VARIANT CONTEXT ----------

/**
 * Given full doc text, produce one ParsedEmailComp per audience segment.
 *
 * Also:
 *  - Tracks a "current date" from lines like "12/31 ..." or "12-31 ..."
 *  - Tracks a "variant" from that same date line (e.g. "Impact", "Urgency")
 *    by taking the last word before any "(".
 *  - If an Email Comp segment has no date/variant of its own, it inherits
 *    them from the nearest previous date line.
 */
function parseDocument(docText: string): ParsedEmailComp[] {
  const lines = docText.split(/\r?\n/);
  const results: ParsedEmailComp[] = [];

  let currentDateRaw: string | undefined;
  let currentDateNorm: string | undefined;
  let currentVariantRaw: string | undefined;
  let currentVariantNorm: string | undefined;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // If a line starts with a date like "12/31 EOY Match Impact (other text)"
    const dateMatch = trimmed.match(/^(\d{1,2}[\/._-]\d{1,2})\b(.*)$/);
    if (dateMatch) {
      const dateToken = dateMatch[1];
      currentDateRaw = dateToken;
      currentDateNorm = normalizeDate(dateToken);

      // Try to infer variant from the rest of the line (before any "(")
      const afterDate = dateMatch[2] || "";
      const beforeParen = afterDate.split("(")[0].trim();

      let variantRaw: string | undefined;
      if (beforeParen) {
        const tokens = beforeParen.split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          // Take last token before "(" as variant, e.g. "Impact" in "EOY Match Impact"
          variantRaw = tokens[tokens.length - 1];
        }
      }
      currentVariantRaw = variantRaw;
      currentVariantNorm = variantRaw
        ? variantRaw.trim().toLowerCase()
        : undefined;
    }

    const segs = parseLineToSegments(line, idx);

    for (const seg of segs) {
      // Inherit date if missing
      if (!seg.dateRaw && currentDateRaw) {
        seg.dateRaw = currentDateRaw;
        seg.dateNorm = currentDateNorm;
      }
      // Inherit variant if missing
      if (!seg.variantRaw && currentVariantRaw) {
        seg.variantRaw = currentVariantRaw;
        seg.variantNorm = currentVariantNorm;
      }

      results.push(seg);
    }
  });

  return results;
}

// ---------- matching ----------

/**
 * Find best matching image filename for one parsed audience segment.
 * Uses audience + date/time + variant (Impact/Urgency) if present.
 */
export function findMatchingImage(
  parsed: ParsedEmailComp,
  images: ImageFile[]
): MatchResult {
  const dateToken = parsed.dateNorm;
  const timeToken = parsed.timeNorm;
  const audienceToken = parsed.audience;
  const variantToken = parsed.variantNorm; // e.g. "impact", "urgency"

  const candidates = images.filter((img) => {
    const nameLc = img.name.toLowerCase();

    // Audience is required
    const audLc = audienceToken.toLowerCase();
    const audienceOk = nameLc.includes(audLc);
    if (!audienceOk) return false;

    // If we have date, enforce it; otherwise ignore.
    // We check for "12_31", "12-31", and "12.31" variants.
    let dateOk = true;
    if (dateToken) {
      const d = dateToken.toLowerCase(); // e.g. "12_31"
      const variants = [
        d,
        d.replace(/_/g, "-"),
        d.replace(/_/g, "."),
      ];
      dateOk = variants.some((v) => nameLc.includes(v));
    }

    // If we have time, enforce it; otherwise ignore
    let timeOk = true;
    if (timeToken) {
      const t = timeToken.toLowerCase();
      const variants = [
        t,
        t.replace("am", "a").replace("pm", "p"),
      ];
      timeOk = variants.some((v) => nameLc.includes(v));
    }

    // If we have variant (impact/urgency/etc.), enforce it; otherwise ignore
    let variantOk = true;
    if (variantToken) {
      variantOk = nameLc.includes(variantToken);
    }

    return dateOk && timeOk && variantOk;
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
 * returns match results for every audience segment found.
 */
export function matchEmailLinesToImages(
  docText: string,
  images: ImageFile[]
): MatchResult[] {
  const segments = parseDocument(docText);
  const results: MatchResult[] = [];

  for (const seg of segments) {
    const match = findMatchingImage(seg, images);
    results.push(match);
  }

  return results;
}
