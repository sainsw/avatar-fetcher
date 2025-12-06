import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp, { AvailableFormatInfo, FormatEnum, Sharp } from "sharp";

export type AvatarFormat = keyof FormatEnum;

export interface AvatarOutputSetting {
  format: AvatarFormat;
  width?: number;
  height?: number;
  quality?: number;
  /**
   * Optional suffix included in the filename after the hash.
   * Example: suffix "small" produces avatar-<hash>-small.webp
   */
  suffix?: string;
}

export interface AvatarOutput {
  buffer: Buffer;
  format: AvatarFormat;
  filename: string;
  width: number;
  height: number;
}

export interface AvatarFetchOptions {
  username: string;
  size?: number;
  token?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export interface AvatarPipelineOptions extends AvatarFetchOptions {
  outputs?: AvatarOutputSetting[];
  baseName?: string;
}

export interface AvatarPipelineResult {
  avatarUrl: string;
  hash: string;
  raw: Buffer;
  outputs: AvatarOutput[];
}

const DEFAULT_OUTPUTS: AvatarOutputSetting[] = [
  { format: "webp", width: 200, height: 200, quality: 85 },
  { format: "jpeg", width: 200, height: 200, quality: 90, suffix: "fallback" },
];

const ensureFetch = (customFetch?: typeof fetch): typeof fetch => {
  if (customFetch) return customFetch;
  if (typeof fetch !== "undefined") return fetch;
  throw new Error("Global fetch is not available. Provide fetchImpl in options.");
};

const buildFilename = (baseName: string, hash: string, setting: AvatarOutputSetting) => {
  const ext = setting.format === "jpeg" ? "jpg" : setting.format;
  const suffix = setting.suffix ? `-${setting.suffix}` : "";
  return `${baseName}-${hash}${suffix}.${ext}`;
};

const hashBuffer = (buffer: Buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 8);

export async function fetchAvatarBuffer(options: AvatarFetchOptions): Promise<{ buffer: Buffer; avatarUrl: string }> {
  const { username, size = 400, token, userAgent = "avatar-fetcher", fetchImpl } = options;
  if (!username) {
    throw new Error("username is required");
  }

  const fetchFn = ensureFetch(fetchImpl);

  const userResponse = await fetchFn(`https://api.github.com/users/${username}`, {
    headers: {
      "User-Agent": userAgent,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.github+json",
    },
  });

  if (!userResponse.ok) {
    throw new Error(`GitHub API returned ${userResponse.status} for user ${username}`);
  }

  const userJson: { avatar_url?: string } = await userResponse.json();
  if (!userJson.avatar_url) {
    throw new Error("No avatar_url in GitHub response");
  }

  const avatarUrl = `${userJson.avatar_url}&s=${size}`;
  const avatarResponse = await fetchFn(avatarUrl, {
    headers: { "User-Agent": userAgent },
  });

  if (!avatarResponse.ok) {
    throw new Error(`Failed to fetch avatar image: ${avatarResponse.status}`);
  }

  const arrayBuffer = await avatarResponse.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), avatarUrl };
}

const applyResize = (instance: Sharp, setting: AvatarOutputSetting) => {
  const width = setting.width ?? setting.height ?? 200;
  const height = setting.height ?? setting.width ?? 200;
  return instance.resize(width, height, { fit: "cover", position: "centre" });
};

const applyFormat = (instance: Sharp, setting: AvatarOutputSetting) => {
  const quality = setting.quality ?? (setting.format === "webp" ? 85 : 90);
  const options: Record<string, unknown> = { quality };
  if (setting.format === "webp") {
    options.effort = 6;
  }
  return instance.toFormat(setting.format as keyof FormatEnum, options as AvailableFormatInfo);
};

export async function buildOptimisedOutputs(
  buffer: Buffer,
  hash: string,
  options?: { outputs?: AvatarOutputSetting[]; baseName?: string },
): Promise<AvatarOutput[]> {
  const outputs = options?.outputs?.length ? options.outputs : DEFAULT_OUTPUTS;
  const baseName = options?.baseName ?? "avatar";

  const results: AvatarOutput[] = [];

  for (const setting of outputs) {
    const pipeline = sharp(buffer);
    const formatted = applyFormat(applyResize(pipeline, setting), setting);
    const data = await formatted.toBuffer();

    const metadata = await sharp(data).metadata();
    results.push({
      buffer: data,
      format: setting.format,
      filename: buildFilename(baseName, hash, setting),
      width: metadata.width ?? (setting.width ?? setting.height ?? 200),
      height: metadata.height ?? (setting.height ?? setting.width ?? 200),
    });
  }

  return results;
}

export async function fetchAndProcessAvatar(options: AvatarPipelineOptions): Promise<AvatarPipelineResult> {
  const { outputs, baseName, ...fetchOptions } = options;
  const { buffer, avatarUrl } = await fetchAvatarBuffer(fetchOptions);
  const hash = hashBuffer(buffer);
  const optimised = await buildOptimisedOutputs(buffer, hash, { outputs, baseName });
  return {
    avatarUrl,
    hash,
    raw: buffer,
    outputs: optimised,
  };
}

export const writeOutputs = async (outputs: AvatarOutput[], outputDir: string) => {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const output of outputs) {
    const filepath = path.join(outputDir, output.filename);
    fs.writeFileSync(filepath, output.buffer);
  }
};

export const DEFAULT_SETTINGS = DEFAULT_OUTPUTS;
