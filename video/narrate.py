"""Narrate each story card separately so speech and captions follow the edit."""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
output = root / "public" / "demo"
output.mkdir(parents=True, exist_ok=True)
story = json.loads((root / "video" / "story.json").read_text(encoding="utf-8"))

def timestamp(seconds):
    millis = round(seconds * 1000)
    return f"{millis // 3600000:02}:{millis // 60000 % 60:02}:{millis // 1000 % 60:02}.{millis % 1000:03}"

captions, start = ["WEBVTT\n"], 0
with tempfile.TemporaryDirectory(prefix="lossless-narration-") as directory:
    directory = Path(directory)
    tracks = []
    for index, card in enumerate(story):
        audio = directory / f"{index}.mp3"
        padded = directory / f"{index}.wav"
        subprocess.run([sys.executable, "-m", "edge_tts", "--voice", "en-US-GuyNeural", "--rate=+0%",
                        "--text", card["narration"], "--write-media", str(audio)], check=True)
        duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio)]))
        lead_in = 0.12
        if card.get("timing") == "speech":
            # Keep a brief reading beat, not several seconds of padded silence.
            card["seconds"] = math.ceil((duration + lead_in + 0.35) * 30) / 30
        print(f"Card {index + 1}: speech {duration:.2f}s / scene {card['seconds']:.2f}s")
        if duration + lead_in > card["seconds"]:
            raise RuntimeError(f"Card {index + 1}: speech is {duration:.2f}s, exceeds {card['seconds']}s; adjust script or timing")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-af", "adelay=120:all=1,apad", "-t", str(card["seconds"]), "-ar", "48000", "-ac", "2", str(padded)], check=True)
        tracks.append(padded)
        captions.append(f"{timestamp(start + lead_in)} --> {timestamp(start + card['seconds'])}\n{card['narration']}\n")
        start += card["seconds"]
    manifest = directory / "tracks.txt"
    manifest.write_text("\n".join(f"file '{track.as_posix()}'" for track in tracks), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c:a", "libmp3lame", "-b:a", "192k", str(output / "voiceover.mp3")], check=True)
(output / "captions.vtt").write_text("\n".join(captions), encoding="utf-8")
(root / "video" / "narration.txt").write_text("\n".join(card["narration"] for card in story) + "\n", encoding="utf-8")
(root / "video" / "story.json").write_text(json.dumps(story, indent=2) + "\n", encoding="utf-8")
print(f"Total: {start:.2f}s")
