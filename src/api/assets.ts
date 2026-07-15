import { existsSync, mkdirSync } from "fs";
import path from "path";

import type { ApiConfig } from "../config";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function mediaTypeToExt(mediaType: string) {
  const parts = mediaType.split("/");
  if (parts.length !== 2) {
    return ".bin";
  }
  return "." + parts[1];
}

export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
  return path.join(cfg.assetsRoot, assetPath);
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
  return `http://localhost:${cfg.port}/assets/${assetPath}`;
}

export async function getVideoAspectRatio(filePath: string | undefined) {
  if (!filePath) {
    return "other"
  }

  const proc = Bun.spawn(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", filePath], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdoutText = await new Response(proc.stdout).text();

  const exitCode = await proc.exited;
  if (exitCode === 0) {
    const videoMeta = JSON.parse(stdoutText)
    const width = videoMeta.streams[0]?.width;
    const height = videoMeta.streams[0]?.height;

    if (!width || !height) {
      return "other";
    }

    const ratio = width / height;
    const epsilon = 0.1;

    if (Math.abs(ratio - 16 / 9) < epsilon) {
      return "landscape";
    }
    if (Math.abs(ratio - 9 / 16) < epsilon) {
      return "portrait";
    }
    return "other";
  } else {
    throw new Error(`Something went wrong with ffprobe for ${filePath}`);
  }
}