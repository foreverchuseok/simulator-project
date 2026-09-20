# -*- coding: utf-8 -*-
"""YouTube 참고 영상을 로컬 작업 자료로 만든다.

다운로드(mp4) + 메타정보(json) + ffmpeg 프레임 추출 + faster-whisper 전사.
결과는 temporary/ 아래에만 저장한다(Git 제외).

사용법:
    python tools/prepare_youtube_reference.py URL [--label car-door] [--interval 20]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAIN_HINT = (
    "엘리베이터 승강기 카 도어 카문 승장문 행거 롤러 인터록 클러치 오퍼레이터 "
    "삼방틀 실 토가드 연동로프 도어추 삼각키 걸쇠 승강로"
)


def run(cmd: list[str], **kwargs) -> None:
    print("[cmd]", " ".join(cmd), file=sys.stderr, flush=True)
    subprocess.run(cmd, check=True, **kwargs)


def slug(text: str, fallback: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:48] or fallback


def download(url: str, out_dir: Path) -> dict:
    info_path = out_dir / "info.json"
    media_path = out_dir / "source.%(ext)s"
    run([
        sys.executable, "-m", "yt_dlp",
        "--no-playlist",
        "--write-info-json",
        "--merge-output-format", "mp4",
        "-o", str(media_path),
        url,
    ])
    info_files = sorted(out_dir.glob("*.info.json"))
    if info_files:
        info_files[-1].replace(info_path)
    with info_path.open(encoding="utf-8") as fh:
        info = json.load(fh)
    mp4 = out_dir / "source.mp4"
    if not mp4.exists():
        candidates = list(out_dir.glob("source.*"))
        if not candidates:
            raise FileNotFoundError(f"다운로드 mp4를 찾을 수 없음: {out_dir}")
        mp4 = candidates[0]
    return {"info": info, "video": mp4}


def extract_frames(video: Path, frames_dir: Path, interval: float) -> list[Path]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%04d.jpg"
    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(video),
        "-vf", f"fps=1/{interval}",
        "-q:v", "2",
        str(pattern),
    ])
    return sorted(frames_dir.glob("frame_*.jpg"))


def extract_wav(video: Path, wav: Path) -> None:
    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(video),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(wav),
    ])


def transcribe(wav: Path, out_txt: Path, model_name: str) -> None:
    from faster_whisper import WhisperModel

    print(f"[whisper] {model_name}", file=sys.stderr, flush=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(wav),
        language="ko",
        beam_size=8,
        vad_filter=False,
        initial_prompt=DOMAIN_HINT,
        condition_on_previous_text=False,
    )
    lines = [f"[{seg.start:6.1f} - {seg.end:6.1f}] {seg.text.strip()}" for seg in segments]
    out_txt.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[transcript] {info.duration:.1f}s -> {out_txt}", file=sys.stderr)


def write_index(out_dir: Path, info: dict, video: Path, frames: list[Path], transcript: Path) -> None:
    index = {
        "id": info.get("id"),
        "title": info.get("title"),
        "url": info.get("webpage_url") or info.get("original_url"),
        "duration_sec": info.get("duration"),
        "video": video.name,
        "transcript": transcript.name,
        "frame_interval_sec": None,
        "frames": [f.name for f in frames],
    }
    (out_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("url", help="YouTube URL")
    ap.add_argument("--label", default="car-door", help="temporary/ 아래 폴더 이름")
    ap.add_argument("--interval", type=float, default=20.0, help="프레임 추출 간격(초)")
    ap.add_argument("--model", default="small", help="whisper 모델 (small/medium/large-v3)")
    ap.add_argument("--skip-transcript", action="store_true")
    args = ap.parse_args()

    title_slug = slug(args.label, "youtube-ref")
    out_dir = ROOT / "temporary" / title_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = download(args.url, out_dir)
    video: Path = meta["video"]
    info: dict = meta["info"]

    frames_dir = out_dir / "frames"
    frames = extract_frames(video, frames_dir, args.interval)

    transcript = out_dir / "transcript.txt"
    if not args.skip_transcript:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "audio.wav"
            extract_wav(video, wav)
            transcribe(wav, transcript, args.model)
    else:
        transcript.write_text("", encoding="utf-8")

    index_path = out_dir / "index.json"
    payload = {
        "id": info.get("id"),
        "title": info.get("title"),
        "url": info.get("webpage_url") or args.url,
        "duration_sec": info.get("duration"),
        "video": video.name,
        "transcript": transcript.name,
        "frame_interval_sec": args.interval,
        "frames": [f.name for f in frames],
    }
    index_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"[done] {out_dir}")
    print(f"  video      : {video}")
    print(f"  frames     : {len(frames)} files / {args.interval}s")
    print(f"  transcript : {transcript}")
    print(f"  index      : {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
