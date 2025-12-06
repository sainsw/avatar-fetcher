#!/usr/bin/env node
import path from "path";
import {
  fetchAndProcessAvatar,
  type AvatarOutputSetting,
  type AvatarFetchOptions,
  writeOutputs,
} from "./index";

interface CliOptions {
  username: string;
  outputDir: string;
  size: number;
  token?: string;
  userAgent?: string;
  outputs?: AvatarOutputSetting[];
  baseName?: string;
}

const parseOutputs = (value?: string): AvatarOutputSetting[] | undefined => {
  if (!value) return undefined;
  return value.split(",").map((chunk) => {
    const [format, sizeStr, qualityStr, suffix] = chunk.split(":");
    const size = sizeStr ? Number(sizeStr) : undefined;
    const quality = qualityStr ? Number(qualityStr) : undefined;
    if (!format) {
      throw new Error(`Invalid output spec: "${chunk}"`);
    }
    return {
      format: format as AvatarOutputSetting["format"],
      width: size,
      height: size,
      quality,
      suffix: suffix || undefined,
    };
  });
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const opts: Partial<CliOptions> = {
    size: 400,
    outputDir: path.join(process.cwd(), "avatars"),
    baseName: "avatar",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "-u" || arg === "--user") && next) {
      opts.username = next;
      i++;
      continue;
    }
    if ((arg === "-o" || arg === "--out") && next) {
      opts.outputDir = path.resolve(next);
      i++;
      continue;
    }
    if (arg === "--size" && next) {
      opts.size = Number(next);
      i++;
      continue;
    }
    if (arg === "--token" && next) {
      opts.token = next;
      i++;
      continue;
    }
    if (arg === "--user-agent" && next) {
      opts.userAgent = next;
      i++;
      continue;
    }
    if (arg === "--outputs" && next) {
      opts.outputs = parseOutputs(next);
      i++;
      continue;
    }
    if (arg === "--base" && next) {
      opts.baseName = next;
      i++;
      continue;
    }
  }

  if (!opts.username) {
    console.error("Usage: avatar-fetcher --user <github-username> [--out ./output] [--size 400] [--outputs webp:200:85,jpeg:200:90]");
    process.exit(1);
  }

  return opts as CliOptions;
};

async function main() {
  try {
    const { username, size, token, userAgent, outputDir, outputs, baseName } = parseArgs();
    const fetchOptions: AvatarFetchOptions = { username, size, token, userAgent };
    const result = await fetchAndProcessAvatar({ ...fetchOptions, outputs, baseName });
    await writeOutputs(result.outputs, outputDir);

    console.log(`Fetched ${username} avatar from ${result.avatarUrl}`);
    console.log(`Saved ${result.outputs.length} file(s) to ${outputDir}`);
    console.log(`Hash: ${result.hash}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Avatar fetch failed: ${message}`);
    process.exit(1);
  }
}

main();
