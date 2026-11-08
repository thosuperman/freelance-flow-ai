// Renders the video's still graphics with Chromium: section labels, caption strips and the end card.
//   node scripts/video/assets.mjs
// Reads submission/video/captions.json (written by build.py) and writes PNGs to submission/video/assets/.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const OUT = "submission/video/assets";
await mkdir(OUT, { recursive: true });
const { sections, captions } = JSON.parse(await readFile("submission/video/captions.json", "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const font = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
const shoot = async (html, file, omitBackground = true) => {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent;font-family:${font}">${html}</body></html>`);
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground });
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Static frame: dark canvas with the small brand mark top-left.
await shoot(
  `<div style="width:1920px;height:1080px;background:linear-gradient(180deg,#0b1020,#111833)">
     <div style="position:absolute;left:44px;top:14px;display:flex;align-items:center;gap:10px;color:#c7d2fe;font-size:20px;font-weight:600">
       <span style="width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#6366f1,#4338ca);display:inline-flex;align-items:center;justify-content:center">
         <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9a4 4 0 0 1 0 8H8"/><path d="M11 12l-3 3 3 3"/></svg>
       </span>FreelanceFlow AI</div>
   </div>`,
  "frame.png",
  false,
);

for (const s of sections) {
  await shoot(
    `<div style="position:absolute;top:10px;left:0;width:1920px;display:flex;justify-content:center">
       <div style="padding:6px 18px;border-radius:999px;background:rgba(99,102,241,.22);border:1px solid rgba(165,180,252,.55);color:#e0e7ff;font-size:22px;font-weight:600;letter-spacing:.3px">${esc(s.title)}</div>
     </div>`,
    `section-${s.id}.png`,
  );
}

for (const [i, c] of captions.entries()) {
  await shoot(
    `<div style="position:absolute;bottom:14px;left:0;width:1920px;display:flex;justify-content:center">
       <div style="max-width:1560px;text-align:center;color:#fff;font-size:34px;line-height:1.3;font-weight:500;text-shadow:0 1px 2px rgba(0,0,0,.6)">${esc(c.text)}</div>
     </div>`,
    `cap-${String(i).padStart(3, "0")}.png`,
  );
}

await shoot(
  `<div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,#1e2a5a,#0b1020 70%);color:#fff;text-align:center">
     <div style="display:flex;align-items:center;gap:26px">
       <div style="width:112px;height:112px;border-radius:26px;background:linear-gradient(135deg,#6366f1,#4338ca);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(79,70,229,.45)">
         <svg viewBox="0 0 24 24" width="66" height="66" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9a4 4 0 0 1 0 8H8"/><path d="M11 12l-3 3 3 3"/></svg>
       </div>
       <div style="font-size:88px;font-weight:700;letter-spacing:-2px">FreelanceFlow <span style="color:#a5b4fc">AI</span></div>
     </div>
     <div style="margin-top:44px;font-size:46px;font-weight:600;line-height:1.3">From conversation to contract.<br><span style="color:#a5b4fc">From work to payment.</span></div>
     <div style="margin-top:46px;font-size:34px;color:#c7d2fe">freelanceflow.hayaix.tech</div>
     <div style="margin-top:26px;font-size:22px;color:#94a3b8">Built for the PayPal AI Hackathon 2026 · PayPal Sandbox · Claude</div>
   </div>`,
  "endcard.png",
  false,
);
await browser.close();
console.log(`rendered ${sections.length} labels, ${captions.length} captions, frame, end card`);
