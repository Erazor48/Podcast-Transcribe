"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  ForwardIcon,
  PlayIcon,
  RewindIcon,
  UploadIcon,
  PauseIcon,
  MicIcon,
} from "lucide-react";
import Image from "next/image";
import { useAudioWaveform } from "@/app/components/use-audio-waveform";

interface AudioPlayerProps {}

interface Track {
  title: string;
  artist: string;
  src: string;
  /** Fichier d’origine (pour envoi à l’API Whisper) */
  file?: File;
}

/** Segment de transcription type Whisper */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Format JSON possible retourné par Whisper */
interface WhisperSegmentsResponse {
  segments?: Array< { start: number; end: number; text: string } >;
}

const AudioPlayer: React.FC<AudioPlayerProps> = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptJsonInput, setTranscriptJsonInput] = useState<string>("");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const currentSegmentRef = useRef<HTMLDivElement | null>(null);

  const currentTrack = tracks[currentTrackIndex];
  const audioSrc = currentTrack?.src ?? null;
  const { samples, loading: waveformLoading } = useAudioWaveform(audioSrc);

  // ——— Upload (on garde le File pour la transcription Whisper) ———
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newTracks: Track[] = Array.from(files).map((file) => ({
        title: file.name,
        artist: "Unknown Artist",
        src: URL.createObjectURL(file),
        file,
      }));
      setTracks((prev) => [...prev, ...newTracks]);
    }
  };

  // ——— Play / Pause (sans repartir du début) ———
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // ——— Seek : placer la lecture à la position voulue ———
  const seekTo = useCallback((timeSeconds: number) => {
    if (!audioRef.current) return;
    const t = Math.max(0, Math.min(timeSeconds, duration || 0));
    audioRef.current.currentTime = t;
    setCurrentTime(t);
    setProgress(duration ? (t / duration) * 100 : 0);
  }, [duration]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    seekTo(pct * duration);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    seekTo(pct * duration);
  };

  const handleWaveformMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(pct * duration);
  };

  const handleWaveformMouseLeave = () => setHoverTime(null);

  // ——— Time update & metadata ———
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const t = audioRef.current.currentTime;
      const d = audioRef.current.duration;
      setCurrentTime(t);
      setDuration(d);
      setProgress(d ? (t / d) * 100 : 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // ——— Changement de piste : charger la nouvelle source et remettre à 0 (sans toucher à isPlaying pour la pause) ———
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    const src = tracks[currentTrackIndex]?.src ?? "";
    audio.pause();
    audio.src = src;
    audio.load();
    audio.currentTime = 0;
    setCurrentTime(0);
    setProgress(0);
    setDuration(0);
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrackIndex, tracks]);

  // ——— Synchroniser play/pause avec le bouton (sans réinitialiser la position) ———
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ——— Scroll vers le segment en cours pour la transcription ———
  useEffect(() => {
    const idx = transcriptSegments.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    if (idx >= 0 && currentSegmentRef.current) {
      currentSegmentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentTime, transcriptSegments]);

  // ——— Importer transcription Whisper (JSON) ———
  const applyTranscriptJson = () => {
    try {
      const raw = transcriptJsonInput.trim();
      if (!raw) return;
      const data = JSON.parse(raw) as WhisperSegmentsResponse;
      const segs = data.segments ?? (Array.isArray(data) ? data : []);
      setTranscriptSegments(
        segs.map((s) => ({
          start: Number(s.start),
          end: Number(s.end),
          text: String(s.text ?? "").trim(),
        }))
      );
    } catch {
      console.error("JSON de transcription invalide");
    }
  };

  const updateSegmentText = (index: number, text: string) => {
    setTranscriptSegments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, text } : s))
    );
  };

  // ——— Générer la transcription (Whisper) sur l’audio en cours ———
  const getAudioFileForTranscribe = async (): Promise<File | null> => {
    const track = currentTrack;
    if (!track) return null;
    if (track.file) return track.file;
    try {
      const res = await fetch(track.src);
      const blob = await res.blob();
      const ext = track.title.includes(".") ? track.title.split(".").pop() ?? "mp3" : "mp3";
      return new File([blob], track.title.endsWith(`.${ext}`) ? track.title : `${track.title}.${ext}`, { type: blob.type || "audio/mpeg" });
    } catch {
      return null;
    }
  };

  const handleGenerateTranscription = async () => {
    setTranscribeError(null);
    const file = await getAudioFileForTranscribe();
    if (!file) {
      setTranscribeError("Impossible d’accéder au fichier audio.");
      return;
    }
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/transcribe-local", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setTranscribeError(data.error ?? "Erreur lors de la transcription");
        return;
      }
      const segs = (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
        start: Number(s.start),
        end: Number(s.end),
        text: String(s.text ?? "").trim(),
      }));
      setTranscriptSegments(segs);
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setTranscribing(false);
    }
  };

  // ——— Dessin de la waveform (vraie courbe audio) + tête de lecture + survol ———
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas || !samples?.length || !duration) return;

    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = rect.width;
    const height = rect.height;
    ctx.scale(dpr, dpr);

    const barCount = samples.length;
    const barWidth = Math.max(1, width / barCount);
    const gap = Math.max(0, barWidth * 0.2);
    const drawWidth = barWidth - gap;
    const half = height / 2;
    const maxAmp = Math.max(...Array.from(samples), 0.001);

    ctx.fillStyle = "oklch(0.92 0.003 48.717)";
    ctx.fillRect(0, 0, width, height);

    const progressPct = duration ? currentTime / duration : 0;
    const hoverPct = duration && hoverTime !== null ? hoverTime / duration : null;

    for (let i = 0; i < barCount; i++) {
      const x = i * barWidth + gap / 2;
      const amp = (samples[i] ?? 0) / maxAmp;
      const barH = Math.max(2, half * amp * 0.8);
      const isPast = (i + 0.5) / barCount <= progressPct;
      const isHover = hoverPct !== null && Math.abs((i + 0.5) / barCount - hoverPct) < 0.01;
      ctx.fillStyle = isHover ? "oklch(0.4 0.15 264)" : isPast ? "oklch(0.216 0.006 56)" : "oklch(0.75 0.01 56)";
      ctx.fillRect(x, half - barH, drawWidth, barH * 2);
    }

    ctx.strokeStyle = "oklch(0.216 0.006 56)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressPct * width, 0);
    ctx.lineTo(progressPct * width, height);
    ctx.stroke();

    if (hoverPct !== null) {
      ctx.strokeStyle = "oklch(0.4 0.15 264)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPct * width, 0);
      ctx.lineTo(hoverPct * width, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [samples, duration, currentTime, hoverTime]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="max-w-2xl w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audio Player</h1>
          <label className="flex items-center cursor-pointer">
            <UploadIcon className="w-5 h-5 mr-2" />
            <span>Upload</span>
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Image
              src="/music.svg"
              alt="Album Cover"
              width={100}
              height={100}
              className="rounded-full w-24 h-24 object-cover mx-auto"
            />
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {currentTrack?.title ?? "Audio Title"}
              </h2>
              <p className="text-muted-foreground">
                {currentTrack?.artist ?? "Person Name"}
              </p>
            </div>

            {/* Barre de progression cliquable (seek) */}
            <div className="w-full">
              <div
                ref={progressBarRef}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full rounded-full bg-primary/20 cursor-pointer overflow-hidden"
                onClick={handleProgressBarClick}
              >
                <div
                  className="h-full bg-primary transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Waveform réelle avec tête de lecture et survol */}
            {currentTrack && (
              <div className="w-full">
                <p className="text-xs text-muted-foreground mb-1">
                  Courbe audio — clic pour placer la lecture, survol pour l’instant
                </p>
                <canvas
                  ref={waveformRef}
                  className="w-full h-20 rounded-md cursor-pointer border border-border"
                  style={{ touchAction: "none" }}
                  onMouseMove={handleWaveformMouseMove}
                  onMouseLeave={handleWaveformMouseLeave}
                  onClick={handleWaveformClick}
                />
                {waveformLoading && (
                  <p className="text-xs text-muted-foreground">Chargement de la waveform…</p>
                )}
                {hoverTime !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Survol : {formatTime(hoverTime)}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 justify-center">
              <Button variant="ghost" size="icon" onClick={() => setCurrentTrackIndex((i) => (i === 0 ? tracks.length - 1 : i - 1))}>
                <RewindIcon className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePlayPause}>
                {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentTrackIndex((i) => (i + 1) % tracks.length)}>
                <ForwardIcon className="w-6 h-6" />
              </Button>
            </div>

            {/* Transcription : génération Whisper ou import JSON, affichage éditable synchronisé */}
            <div className="w-full border-t pt-4 space-y-3">
              <h3 className="font-semibold">Transcription (éditable, synchronisée à l’audio)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleGenerateTranscription}
                  disabled={!currentTrack || transcribing}
                >
                  <MicIcon className="w-4 h-4 mr-2" />
                  {transcribing ? "Transcription en cours…" : "Générer la transcription"}
                </Button>
                <span className="text-xs text-muted-foreground">ou coller un JSON :</span>
                <textarea
                  className="flex-1 min-w-[200px] min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder='{"segments":[{"start":0,"end":1.5,"text":"Bonjour"}]}'
                  value={transcriptJsonInput}
                  onChange={(e) => setTranscriptJsonInput(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={applyTranscriptJson}>
                  Importer
                </Button>
              </div>
              {transcribeError && (
                <p className="text-sm text-destructive">{transcribeError}</p>
              )}
              <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border border-border p-2">
                {transcriptSegments.length === 0 && !transcribing && (
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur « Générer la transcription » pour transcrire l’audio en cours avec Whisper, ou importez un JSON.
                  </p>
                )}
                {transcriptSegments.map((seg, idx) => {
                  const isActive = currentTime >= seg.start && currentTime <= seg.end;
                  return (
                    <div
                      key={`${seg.start}-${idx}`}
                      ref={isActive ? currentSegmentRef : null}
                      className={`rounded px-2 py-1 ${isActive ? "bg-primary/15 ring-1 ring-primary/30" : ""}`}
                    >
                      <span className="text-xs text-muted-foreground mr-2">
                        {formatTime(seg.start)} → {formatTime(seg.end)}
                      </span>
                      <input
                        type="text"
                        className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-primary"
                        value={seg.text}
                        onChange={(e) => updateSegmentText(idx, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <audio
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AudioPlayer;
