#!/usr/bin/env python3
"""
Transcrit un fichier audio avec openai-whisper (modèle local).
Usage: python transcribe_local.py <chemin_vers_audio>
Sortie: JSON sur stdout, format { "segments": [ { "start", "end", "text" }, ... ] }
"""
import json
import os
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: transcribe_local.py <audio_path>"}), file=sys.stderr)
        sys.exit(1)

    audio_path = os.path.abspath(sys.argv[1])
    if not os.path.isfile(audio_path):
        print(json.dumps({"error": f"Fichier introuvable: {audio_path}"}), file=sys.stderr)
        sys.exit(1)

    model_name = os.environ.get("WHISPER_MODEL", "base")

    try:
        import whisper
    except ImportError:
        print(
            json.dumps({"error": "openai-whisper non installé. Exécutez: pip install -r scripts/requirements.txt"}),
            file=sys.stderr,
        )
        sys.exit(1)

    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path)

    segments = [
        {"start": float(s["start"]), "end": float(s["end"]), "text": (s.get("text") or "").strip()}
        for s in result.get("segments", [])
    ]

    print(json.dumps({"segments": segments}))


if __name__ == "__main__":
    main()
