import { NextRequest, NextResponse } from "next/server";

/**
 * Route API pour transcrire un fichier audio avec OpenAI Whisper.
 * Retourne les segments avec start, end, text (synchronisés à l’audio).
 *
 * Nécessite OPENAI_API_KEY dans .env.local
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY non configurée. Ajoutez-la dans .env.local" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corps de la requête invalide (FormData attendu)" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Fichier audio manquant (champ 'file')" },
      { status: 400 }
    );
  }

  const language = formData.get("language") as string | null;

  const body = new FormData();
  body.append("file", file);
  body.append("model", "whisper-1");
  body.append("response_format", "verbose_json");
  body.append("timestamp_granularities[]", "segment");
  if (language?.trim()) {
    body.append("language", language.trim());
  }

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // pas de Content-Type : fetch définit la boundary pour FormData
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Whisper API: ${res.status} - ${err}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as {
      segments?: Array< { start: number; end: number; text: string } >;
      text?: string;
    };

    const segments = (data.segments ?? []).map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      text: String(s.text ?? "").trim(),
    }));

    return NextResponse.json({ segments });
  } catch (e) {
    console.error("Transcribe API error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur lors de la transcription" },
      { status: 502 }
    );
  }
}
