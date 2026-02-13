"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Récupère les données de waveform (échantillons normalisés) à partir d'une URL audio.
 * Utilise l'API Web Audio pour décoder le fichier.
 */
export function useAudioWaveform(audioSrc: string | null): {
  samples: Float32Array | null;
  loading: boolean;
  error: string | null;
} {
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioSrc) {
      setSamples(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await fetch(audioSrc);
        if (!response.ok) throw new Error("Échec du chargement audio");
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const channel = decoded.getChannelData(0);
        // Sous-échantillonner pour ~1 point par 2px environ (ex: 800px -> 400 points)
        const targetLength = 600;
        const blockSize = Math.floor(channel.length / targetLength);
        const out = new Float32Array(targetLength);
        for (let i = 0; i < targetLength; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channel.length);
          for (let j = start; j < end; j++) sum += Math.abs(channel[j] ?? 0);
          out[i] = end > start ? sum / (end - start) : 0;
        }
        setSamples(out);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur waveform");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [audioSrc]);

  return { samples, loading, error };
}
