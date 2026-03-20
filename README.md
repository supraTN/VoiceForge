# VoiceForge — TTS, Voice Cloning & Video Dubbing

Projet full-stack qui combine synthese vocale, clonage de voix et doublage video automatique.
Realise dans le cadre d'un projet scolaire.

## Fonctionnalites

### Text-to-Speech (Kokoro)
- Synthese vocale realiste en francais et anglais (US/UK)
- Choix de voix et vitesse ajustable
- Rendu audio WAV en streaming

### Voice Cloning (XTTS v2)
- Clonage zero-shot a partir de 1 a 3 echantillons WAV
- Enrolement par utilisateur avec gestion de profils vocaux
- Synthese avec la voix clonee dans plusieurs langues

### Video Dubbing
- Pipeline complet : upload video → transcription (Whisper) → traduction (M2M100) → synthese vocale → remux MP4
- Mode "replace" (voix seule) ou "mix" (voix + audio original attenue)
- Generation automatique de sous-titres SRT et transcript JSON
- Time-stretching intelligent pour synchroniser la voix aux segments d'origine

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Backend** | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **TTS** | Kokoro (KPipeline) pour la synthese generique |
| **Voice Cloning** | Coqui XTTS v2 (zero-shot, multilingual) |
| **ASR** | Faster-Whisper (CTranslate2) |
| **Traduction** | Facebook M2M100 (418M) via HuggingFace Transformers |
| **Audio/Video** | FFmpeg (extraction, mixage, remux, time-stretch) |
| **Infra** | Docker (CPU) |

## Architecture

```
app/
├── main.py                 # Point d'entree FastAPI + middlewares
├── config.py               # Configuration (env vars, CORS, limites)
├── deps.py                 # Chargement des modeles ML (singletons)
├── tts_service.py          # Wrapper Kokoro TTS
├── clone_service.py        # Service XTTS v2 (enrolement + synthese)
├── video_asr.py            # Integration Faster-Whisper
├── video_mt.py             # Integration M2M100
├── routers/
│   ├── tts.py              # Endpoints /tts, /voices
│   ├── clone.py            # Endpoints /clone/enroll, /clone/voices, /tts/cloned
│   └── video.py            # Endpoints /video/transcribe, /video/translate, /video/dub
└── services/
    └── dubbing.py          # Utilitaires FFmpeg (extraction, mix, SRT, time-stretch)

tts-frontend/
├── src/
│   ├── App.tsx             # Layout principal + navigation par onglets
│   ├── api.ts              # Client Axios avec intercepteurs
│   ├── pages/
│   │   ├── TTSPage.tsx     # Interface synthese vocale
│   │   ├── ClonePage.tsx   # Interface clonage vocal
│   │   └── VideoPage.tsx   # Interface doublage video
│   ├── components/         # Header, Logo, Tabs
│   └── utils/
│       └── apiError.ts     # Extraction d'erreurs depuis les reponses Blob
```

## Installation

### Pre-requis

- Python 3.11+
- Node.js 18+
- FFmpeg installe et accessible dans le PATH

### Backend

```bash
# Creer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Installer les dependances
pip install -r requirements.txt

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

> Les modeles ML (Kokoro, XTTS, Whisper, M2M100) sont telecharges automatiquement au premier lancement.
> Prevoir ~5 Go d'espace disque pour les poids des modeles.

### Frontend

```bash
cd tts-frontend
npm install
npm run dev
```

Le frontend sera accessible sur `http://localhost:5173`.

### Docker

```bash
docker build -t voiceforge .
docker run -p 8000:8000 voiceforge
```

> L'image Docker utilise le CPU par defaut. Pour du GPU, modifier le Dockerfile et installer `torch+cu121`.

## Endpoints API

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/voices?lang=f` | Liste des voix disponibles par langue |
| `POST` | `/tts` | Synthese vocale generique (Kokoro) |
| `POST` | `/clone/enroll` | Enroler une voix clonee (upload WAV) |
| `GET` | `/clone/voices` | Lister les voix clonees de l'utilisateur |
| `POST` | `/tts/cloned` | Synthese avec voix clonee |
| `POST` | `/video/transcribe` | Transcrire une video (Whisper) |
| `POST` | `/video/translate` | Traduire des segments texte |
| `POST` | `/video/dub` | Pipeline complet de doublage video |

La doc interactive Swagger est disponible sur `/docs` une fois le serveur lance.

## Configuration

Variables d'environnement optionnelles :

| Variable | Default | Description |
|----------|---------|-------------|
| `TTS_BEARER` | *(vide)* | Token Bearer pour proteger les endpoints |
| `MAX_TEXT_CHARS` | `2000` | Limite de caracteres par requete TTS |
| `MAX_UPLOAD_MB` | `25` | Taille max des fichiers uploades |
| `HF_HOME` | `data/hf-cache` | Cache des modeles HuggingFace |

## Langues supportees

| Code | Langue | Voix TTS disponibles |
|------|--------|---------------------|
| `f` | Francais | ff_siwis |
| `a` | Anglais (US) | af_heart, af_bella, af_nicole, am_michael |
| `b` | Anglais (UK) | bf_emma, bm_george |

Le clonage vocal et le doublage video supportent toutes les langues prises en charge par XTTS v2 et M2M100.
