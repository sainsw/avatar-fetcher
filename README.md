# avatar-fetcher

Fetch a GitHub user’s avatar, generate optimised WebP/JPEG versions, and save them with versioned filenames. Ships with a Node API and a tiny CLI.

## Install

```bash
npm install avatar-fetcher
```

Requires Node 18+ (uses the built-in `fetch`) and `sharp` (declared as a dependency).

## API usage

```ts
import { fetchAndProcessAvatar, writeOutputs } from "avatar-fetcher";

async function run() {
  const result = await fetchAndProcessAvatar({
    username: "sainsw",
    size: 400, // GitHub fetch size
    outputs: [
      { format: "webp", width: 200, height: 200, quality: 85 },
      { format: "jpeg", width: 200, height: 200, quality: 90, suffix: "fallback" },
    ],
    baseName: "avatar",
  });

  // Save to disk (filenames include the hash)
  await writeOutputs(result.outputs, "./avatars");

  console.log(result.hash, result.avatarUrl);
}
```

### Options
- `username` (required): GitHub username.
- `size`: avatar size requested from GitHub (default 400).
- `token`: optional GitHub token for higher rate limits.
- `userAgent`: override the fetch user agent.
- `outputs`: list of output settings `{ format, width?, height?, quality?, suffix? }`. Defaults to 200px WebP + JPEG fallback.
- `baseName`: filename prefix (default `avatar`).

### Returned data
- `avatarUrl`: the GitHub URL used.
- `hash`: SHA-256 hash (8 chars) of the raw avatar.
- `raw`: original Buffer from GitHub.
- `outputs`: array of `{ buffer, format, filename, width, height }`.

## CLI usage

```bash
npx avatar-fetcher --user sainsw --out ./public/images --size 400 --outputs webp:200:85,jpeg:200:90:fallback
```

Flags:
- `--user`, `-u` (required): GitHub username.
- `--out`, `-o`: output directory (default: `./avatars`).
- `--size`: GitHub fetch size (default: `400`).
- `--token`: GitHub token.
- `--user-agent`: override user agent.
- `--outputs`: comma-separated list of `format[:size][:quality][:suffix]` (size applies to both width/height). Example: `webp:256:80:sm,jpeg:256:90:fb`.
- `--base`: filename prefix (default: `avatar`).

The CLI writes optimised files to the output directory and prints the hash for reuse.
