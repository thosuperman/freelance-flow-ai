#!/usr/bin/env python3
"""Edits the recorded segments into the final demo video.

  python3 scripts/video/build.py

Inputs:  submission/video/raw/*.webm + events.json (capture.mjs), submission/video/segments.json and
         submission/video/audio/*.wav (narration). Output: submission/video/freelanceflow-demo-final.mp4,
         narration.wav and captions.srt.

Editing rules: AI waiting time is cut out (marked in events.json); clips are only sped up or held on
their last frame to fit the narration. No frame content is altered: amounts, statuses and AI output
are exactly what the app showed.
"""
import json, os, re, subprocess, sys

V = "submission/video"
RAW = f"{V}/raw"
TMP = f"{V}/tmp"
ASSETS = f"{V}/assets"
os.makedirs(TMP, exist_ok=True)
FPS = 30
# App footage placement on the 1920x1080 canvas: label strip on top, caption strip below.
AX, AY, AW, AH = 144, 52, 1632, 918
GAP = 1.3            # seconds of picture after each narration segment
END_CARD = 6.0

events = json.load(open(f"{RAW}/events.json"))
segs = {s["id"]: s for s in json.load(open(f"{V}/segments.json"))}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(" ".join(cmd)); print(r.stderr[-3000:]); sys.exit(1)
    return r.stdout

def dur(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())

def m(seg, key, default=None):
    return events.get(seg, {}).get("marks", {}).get(key, default)

# (segment, [(start, end), ...]) pieces per narration section; None = to clip end.
def piece(seg, start=0.0, end=None, cut=None):
    """Pieces of one raw clip, optionally removing [cut_from, cut_to] (AI waiting)."""
    total = m(seg, "end") or dur(f"{RAW}/{seg}.webm")
    end = total if end is None else end
    if cut and cut[0] is not None and cut[1] is not None and cut[1] > cut[0]:
        return [(seg, start, cut[0]), (seg, cut[1], end)]
    return [(seg, start, end)]

plan = {
    "s1": piece("01-landing", 0.6),
    "s2": piece("02-ai-project", max(0, (m("02-ai-project", "started") or 0) - 0.3), None,
                # keep ~6 s of the real "analysing" state so the AI step reads as real work
                (m("02-ai-project", "analyse", 0) + 4.0, m("02-ai-project", "ai-done", 0) - 3.5)),
    "s3": piece("03-proposal", 0.5, None, (m("03-proposal", "draft", 0) + 1.0, m("03-proposal", "draft-done", 0) - 0.3))
          + piece("04-client-approval", 0.8),
    "s4": piece("05-request-payment", 0.6) + piece("06-paypal-checkout", 0.6) + piece("07-receipt", 0.8) + piece("08-paid-financials", 0.8),
    "s5": piece("09-scope-check", 0.5, None, (m("09-scope-check", "check", 0) + 1.0, m("09-scope-check", "check-done", 0) - 0.3)),
    "s6": piece("10-change-approval", 0.6) + piece("11-final-financials", 0.8, 4.5)
          + piece("12-timeline", max(0, (m("12-timeline", "ready") or 0) - 0.2)) + piece("13-insights", max(0, (m("13-insights", "ready") or 0) - 0.2)),
    "s7": piece("14-dashboard", 0.6),
}

def cut_piece(i, seg, a, b):
    out = f"{TMP}/p{i:02d}.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", f"{RAW}/{seg}.webm",
         "-vf", f"fps={FPS},scale={AW}:{AH}:flags=lanczos,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", out])
    return out

timeline = []   # (section_id, start_time, duration)
section_files = []
t = 0.0
i = 0
for sid in ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]:
    parts = []
    for seg, a, b in plan[sid]:
        if not os.path.exists(f"{RAW}/{seg}.webm"):
            print(f"missing clip {seg}"); sys.exit(1)
        if b - a < 0.4:
            continue
        parts.append(cut_piece(i, seg, a, b)); i += 1
    lst = f"{TMP}/{sid}.txt"
    open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    joined = f"{TMP}/{sid}-joined.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined])
    vis = dur(joined)
    target = segs[sid]["duration"] + GAP
    fitted = f"{TMP}/{sid}-fit.mp4"
    if vis > target:
        factor = target / vis
        vf = f"setpts={factor:.5f}*PTS,fps={FPS}"
    else:
        # Slow gently (down to 0.75x), then hold the last frame for whatever remains.
        slow = min(target / vis, 1 / 0.75)
        hold = max(0.0, target - vis * slow)
        vf = f"setpts={slow:.5f}*PTS,fps={FPS},tpad=stop_mode=clone:stop_duration={hold + 0.05:.3f}"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", joined, "-vf", vf, "-t", f"{target:.3f}", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", fitted])
    speed = vis / target
    print(f"{sid}: footage {vis:5.1f}s → {target:5.1f}s (×{speed:.2f} speed)")
    section_files.append(fitted)
    timeline.append((sid, t, target))
    t += target

# Captions: split each narration segment into sentences, timed by character share of the audio.
captions = []
for sid, start, length in timeline:
    s = segs[sid]
    sentences = [x.strip() for x in re.split(r"(?<=[.?!])\s+", s["text"]) if x.strip()]
    chunks = []
    for sen in sentences:   # keep lines short: split long sentences at commas/colons
        if len(sen) > 95 and re.search(r"[,:]", sen):
            parts = re.split(r"(?<=[,:])\s+", sen)
            buf = ""
            for p in parts:
                if len(buf) + len(p) > 90 and buf:
                    chunks.append(buf.strip()); buf = p
                else:
                    buf = f"{buf} {p}"
            if buf.strip():
                chunks.append(buf.strip())
        else:
            chunks.append(sen)
    speech = s["duration"]
    total_chars = sum(len(c) for c in chunks)
    tt = start + 0.15
    for c in chunks:
        d = speech * len(c) / total_chars
        captions.append({"text": c.replace("capture I D", "capture ID"), "start": round(tt, 2), "end": round(tt + d - 0.05, 2)})
        tt += d

sections = [{"id": sid, "title": segs[sid]["title"], "start": st, "end": st + min(4.0, ln)} for sid, st, ln in timeline if segs[sid]["title"]]
json.dump({"sections": sections, "captions": captions}, open(f"{V}/captions.json", "w"), indent=1)
run(["node", "scripts/video/assets.mjs"])

def srt_time(x):
    h, r = divmod(x, 3600); mm, s = divmod(r, 60)
    return f"{int(h):02d}:{int(mm):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
with open(f"{V}/captions.srt", "w") as f:
    for n, c in enumerate(captions, 1):
        f.write(f"{n}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")

# Body video (app footage), then composite onto the frame with labels and captions.
lst = f"{TMP}/body.txt"
open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in section_files))
body = f"{TMP}/body.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", body])
body_len = dur(body)

inputs = ["-loop", "1", "-framerate", str(FPS), "-i", f"{ASSETS}/frame.png", "-i", body]
filters = [f"[0:v]trim=duration={body_len:.3f},setpts=PTS-STARTPTS[bg]", f"[bg][1:v]overlay={AX}:{AY}:shortest=1[v0]"]
label = "v0"
n = 2
for s in sections:
    inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"{ASSETS}/section-{s['id']}.png"]
    filters.append(f"[{label}][{n}:v]overlay=0:0:enable='between(t,{s['start']:.2f},{s['end']:.2f})'[v{n}]")
    label = f"v{n}"; n += 1
for k, c in enumerate(captions):
    inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"{ASSETS}/cap-{k:03d}.png"]
    filters.append(f"[{label}][{n}:v]overlay=0:0:enable='between(t,{c['start']:.2f},{c['end']:.2f})'[v{n}]")
    label = f"v{n}"; n += 1
filters.append(f"[{label}]format=yuv420p[vout]")
main = f"{TMP}/main.mp4"
script = f"{TMP}/filter.txt"
open(script, "w").write(";\n".join(filters))
run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-/filter_complex", script, "-map", "[vout]", "-t", f"{body_len:.3f}",
     "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", main])

# End card with a fade-in.
end = f"{TMP}/end.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", str(FPS), "-i", f"{ASSETS}/endcard.png", "-t", f"{END_CARD}",
     "-vf", "fade=t=in:st=0:d=0.6,format=yuv420p", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", end])
lst = f"{TMP}/final.txt"
open(lst, "w").write(f"file '{os.path.abspath(main)}'\nfile '{os.path.abspath(end)}'\n")
video_only = f"{TMP}/video-only.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video_only])

# Narration track: each segment placed at its section start; the last segment (s7) runs into the end card.
narr_inputs, delays = [], []
for k, (sid, st, ln) in enumerate(timeline):
    narr_inputs += ["-i", f"{V}/audio/{sid}.wav"]
    delays.append(f"[{k}:a]adelay={int(st * 1000)}|{int(st * 1000)}[a{k}]")
mix = ";".join(delays) + ";" + "".join(f"[a{k}]" for k in range(len(timeline))) + f"amix=inputs={len(timeline)}:normalize=0,apad,atrim=0:{body_len + END_CARD:.3f},loudnorm=I=-16:TP=-1.5:LRA=7[aout]"
narration = f"{V}/narration.wav"
run(["ffmpeg", "-y", "-loglevel", "error", *narr_inputs, "-filter_complex", mix, "-map", "[aout]", "-ar", "48000", "-ac", "2", narration])

final = f"{V}/freelanceflow-demo-final.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", "-i", video_only, "-i", narration, "-map", "0:v", "-map", "1:a",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", final])
print(f"FINAL {final}: {dur(final):.2f}s")
