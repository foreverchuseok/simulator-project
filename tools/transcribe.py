# -*- coding: utf-8 -*-
"""화면 녹화(mp4) 안의 한국어 나레이션을 타임스탬프 붙은 텍스트로 옮긴다.

사용법:
    python tools/transcribe.py "C:\\path\\to\\녹화.mp4" [--model large-v3]

ffmpeg 로 16kHz 모노 wav 를 뽑은 뒤 faster-whisper 로 인식한다.
엘리베이터 도메인 용어는 initial_prompt 로 편향을 걸어 오인식을 줄인다.
"""
import argparse
import os
import subprocess
import sys
import tempfile

# 오인식이 잦은 도메인 용어를 미리 흘려주면 인식률이 크게 오른다.
DOMAIN_HINT = (
    "엘리베이터 승강기 시뮬레이션 조속기 과속조절기 권상기 트랙션 머신 "
    "로프 브레이크 현수도르래 디플렉터 안전기 비상정지장치 라쳇 플라이볼 "
    "쉬브 시브 로프캐치 텐션 스프링 레버 브라켓 스위치 승강로 카 카운터웨이트 "
    "가이드레일 도어 클러치 행거롤러 인터록 실 문턱 기계실 피트 오버헤드 "
    "블렌더 텍스처 메시 지오메트리 카메라 렌더링"
)


def extract_wav(src: str, dst: str) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", src,
         "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", dst],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("media", help="mp4/wav/m4a 등 오디오가 들어있는 파일")
    ap.add_argument("--model", default="large-v3",
                    help="whisper 모델 (tiny/base/small/medium/large-v3)")
    ap.add_argument("--out", default=None, help="결과를 저장할 텍스트 파일")
    # VAD를 켜면 앞뒤 어절이 통째로 잘려 뜻이 바뀐다(실측). 기본은 끔.
    ap.add_argument("--vad", action="store_true", help="VAD 묵음 제거 사용 (권장하지 않음)")
    args = ap.parse_args()

    if not os.path.exists(args.media):
        print(f"파일을 찾을 수 없음: {args.media}", file=sys.stderr)
        return 1

    tmp_wav = None
    audio = args.media
    if not args.media.lower().endswith(".wav"):
        tmp_wav = tempfile.mktemp(suffix=".wav")
        extract_wav(args.media, tmp_wav)
        audio = tmp_wav

    from faster_whisper import WhisperModel

    print(f"[모델 로드] {args.model} (int8/CPU)", file=sys.stderr, flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        audio,
        language="ko",
        beam_size=8,
        vad_filter=args.vad,
        vad_parameters={"min_silence_duration_ms": 400},
        initial_prompt=DOMAIN_HINT,
        condition_on_previous_text=False,  # 반복 루프 방지
    )

    print(f"[길이] {info.duration:.1f}s", file=sys.stderr, flush=True)

    lines = []
    for seg in segments:
        line = f"[{seg.start:6.1f} - {seg.end:6.1f}] {seg.text.strip()}"
        lines.append(line)
        print(line, flush=True)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
        print(f"[저장] {args.out}", file=sys.stderr)

    if tmp_wav and os.path.exists(tmp_wav):
        os.remove(tmp_wav)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
