// src/testMatcher.ts
import {
  matchEmailLinesToImages,
  ImageFile,
} from "./emailMatcher";

// Simulated document text with 4 "Email Comp" lines
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

// Simulated Box image files
const imageFiles: ImageFile[] = [
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
