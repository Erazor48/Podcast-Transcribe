---
title: Podcast Transcribe
emoji: 🎙️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# Podcast Transcribe

A web app for podcasters: load an audio file, transcribe it locally with [OpenAI Whisper](https://github.com/openai/whisper), then edit the transcript segment by segment while it stays synchronized with the audio.

## Features

- Audio player with a real waveform drawn from the loaded file (any `audio/*` file).
- Transcription with local `openai-whisper` through a Python script; no API key needed.
- Time-stamped segments (start, end, text) shown next to the player, with the text editable in place.
- Export of the edited transcript as `.txt` or `.json`.

## How it works

The Next.js page uploads the audio to `POST /api/transcribe-local`. The route saves it to a temporary file, runs `scripts/transcribe_local.py`, and returns `{ "segments": [{ "start", "end", "text" }] }`.

The repo also contains `POST /api/transcribe`, which sends the file to the OpenAI Whisper API (needs `OPENAI_API_KEY`). The current UI does not call it.

## Run locally

Requirements: Node.js 20+, Python 3.10+, and [`ffmpeg`](https://ffmpeg.org/) on your `PATH`.

```bash
# 1. Python environment with Whisper (the app uses ./.venv automatically if it exists)
uv venv
uv pip install -r scripts/requirements.txt

# 2. Web app
npm install
npm run dev
```

Open <http://localhost:3000>. The first transcription downloads the Whisper model (`base` by default).

Environment variables (optional):

| Variable | Purpose | Default |
| --- | --- | --- |
| `WHISPER_MODEL` | Whisper model: `tiny`, `base`, `small`, `medium`, `large`, `turbo` | `base` |
| `WHISPER_PYTHON` | Python command used to run the script | `./.venv` Python, else `python3` |
| `OPENAI_API_KEY` | Only for the unused `/api/transcribe` route | none |

More detail on the local setup: [`scripts/README.md`](scripts/README.md).

## Docker / Hugging Face Spaces

The `Dockerfile` builds the Next.js app, installs Python, `ffmpeg` and `openai-whisper`, and serves on port 7860, which is the port the Space metadata above declares.

```bash
docker build -t podcast-transcribe .
docker run -p 7860:7860 podcast-transcribe
```

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui components, Python with `openai-whisper`.

## Credits

The audio player started from [this tutorial](https://asharibali.medium.com/building-an-audio-player-app-with-next-js-80d06cc1d7d8); see `Explanation_Personnal.md` for the project notes.
