import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

/** Résout la commande Python à utiliser (priorité : WHISPER_PYTHON > .venv du projet > py/python3). */
function getPythonCommand(projectRoot: string): { cmd: string; args: string[] } {
  if (process.env.WHISPER_PYTHON) {
    return { cmd: process.env.WHISPER_PYTHON, args: [] };
  }
  const venvPython =
    process.platform === "win32"
      ? join(projectRoot, ".venv", "Scripts", "python.exe")
      : join(projectRoot, ".venv", "bin", "python");
  if (existsSync(venvPython)) {
    return { cmd: venvPython, args: [] };
  }
  if (process.platform === "win32") {
    return { cmd: "py", args: ["-3"] };
  }
  return { cmd: "python3", args: [] };
}

/**
 * Route API pour transcrire un fichier audio avec openai-whisper en local.
 * Même format de réponse que /api/transcribe : { segments: [ { start, end, text } ] }
 *
 * Prérequis :
 * - Python avec openai-whisper installé (voir scripts/README ou scripts/requirements.txt)
 * - ffmpeg installé sur le système
 */
export async function POST(request: NextRequest) {
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

  const ext =
    (file as File).name?.match(/\.[a-zA-Z0-9]+$/)?.[0] ||
    ".mp3";
  const tempName = `whisper-${Date.now()}-${randomUUID()}${ext}`;
  const tempDir = tmpdir();
  const tempPath = join(tempDir, tempName);

  const projectRoot = process.cwd();
  const scriptPath = join(projectRoot, "scripts", "transcribe_local.py");

  try {
    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    await writeFile(tempPath, buffer);
  } catch (e) {
    console.error("transcribe-local: write temp file", e);
    return NextResponse.json(
      { error: "Impossible d’écrire le fichier temporaire" },
      { status: 500 }
    );
  }

  const { cmd: pythonCmd, args: pythonArgs } = getPythonCommand(projectRoot);
  const args = [...pythonArgs, scriptPath, tempPath];

  const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve) => {
      const proc = spawn(pythonCmd, args, {
        cwd: projectRoot,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += String(d)));
      proc.stderr?.on("data", (d) => (stderr += String(d)));
      proc.on("close", (code) => resolve({ stdout, stderr, code }));
    }
  );

  try {
    await unlink(tempPath);
  } catch {
    // ignore cleanup errors
  }

  if (result.code !== 0) {
    console.error("transcribe-local: script failed", result.stderr);
    const errMsg =
      result.stderr.trim() || "Erreur lors de l’exécution du script Whisper";
    return NextResponse.json(
      { error: errMsg },
      { status: 502 }
    );
  }

  let data: { segments?: Array<{ start: number; end: number; text: string }>; error?: string };
  try {
    data = JSON.parse(result.stdout.trim()) as typeof data;
  } catch {
    return NextResponse.json(
      { error: "Réponse du script Whisper invalide (JSON attendu)" },
      { status: 502 }
    );
  }

  if (data.error) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  const segments = (data.segments ?? []).map((s) => ({
    start: Number(s.start),
    end: Number(s.end),
    text: String(s.text ?? "").trim(),
  }));

  return NextResponse.json({ segments });
}
