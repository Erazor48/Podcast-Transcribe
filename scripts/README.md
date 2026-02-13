# Transcription locale (openai-whisper)

Ce dossier permet de transcrire l’audio **en local** avec [openai-whisper](https://github.com/openai/whisper), sans utiliser l’API OpenAI.

## Prérequis

- **Python 3.8+** (3.9 à 3.11 recommandé)
- **ffmpeg** installé et dans le `PATH`
  - Windows : `choco install ffmpeg` ou [ffmpeg.org](https://ffmpeg.org/)
  - macOS : `brew install ffmpeg`
  - Linux : `sudo apt install ffmpeg` / `sudo pacman -S ffmpeg`

## Installation

Depuis la racine du projet. **L’app utilise automatiquement le Python du `.venv`** s’il existe (compatible `pip` ou `uv`).

### Avec uv

```bash
# Créer le venv et installer les deps
uv venv
uv pip install -r scripts/requirements.txt
```

### Avec pip

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # Linux / macOS
pip install -r scripts/requirements.txt
```

Lors du premier lancement, Whisper télécharge le modèle (par défaut `base`, ~150 Mo).

## Utilisation par l’app

L’app Next.js appelle la route **`/api/transcribe-local`**, qui :

1. Enregistre le fichier audio uploadé dans un fichier temporaire
2. Lance `python scripts/transcribe_local.py <fichier_temp>`
3. Lit la sortie JSON et renvoie `{ segments: [...] }` au client

Assurez-vous que la commande **`python`** (ou **`py -3`** sous Windows) pointe vers le Python où openai-whisper est installé. Si besoin, définissez la variable d’environnement :

- **`WHISPER_PYTHON`** : commande pour lancer Python (ex. `C:\Users\...\.venv\Scripts\python.exe` ou `py`)
- **`WHISPER_MODEL`** : modèle à utiliser (`tiny`, `base`, `small`, `medium`, `large`, `turbo`). Par défaut : `base`.

## Test manuel du script

```bash
python scripts/transcribe_local.py chemin/vers/audio.mp3
```

La sortie est un JSON sur stdout : `{"segments": [{"start": 0.0, "end": 2.5, "text": "..."}, ...]}`.
