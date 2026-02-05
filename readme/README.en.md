# gopeed-extension-github

[简体中文](../README.md) | [English](README.en.md)

GoPeed extension for downloading GitHub repositories: parse repo directories and batch-download files. Suited for large datasets and experiment data.

I built this because cloning a multi-GB dataset repo with `git clone` was too slow. With this extension, GoPeed parses the directory and downloads files with multiple concurrent tasks—more stable than a full clone and with better resume support. This extension was created by AI by adapting [gopeed-extension-huggingface](https://github.com/DSYZayn/gopeed-extension-huggingface); the structure is the same, with the parsing target switched from Hugging Face to the GitHub API.

## Features

- **Repo root** and **subdirectories** under a branch/tag
- **Single file** (blob URL) download
- Root dir uses Git Tree API (one call for full tree); subdirs use Contents API recursively
- Optional **GitHub Token**: higher API rate limit (5000/hr) and access to private repos

## Install

On the GoPeed extensions page, enter this repo’s clone URL, e.g.:

```
https://github.com/DSYZayn/gopeed-extension-github
```

Or use developer mode: click the install button 5 times, then select the local project directory.

---

## Usage

Use a URL that matches one of the formats below to **parse and list all files** in that path (or a single file).

### Supported URL formats

| Case         | URL format                                               | Note                                |
| ------------ | -------------------------------------------------------- | ----------------------------------- |
| Repo root    | `https://github.com/<owner>/<repo>/tree/<branch>`        | Must include `tree/<branch>`        |
| Subdirectory | `https://github.com/<owner>/<repo>/tree/<branch>/<path>` | `<path>` = path inside repo         |
| Single file  | `https://github.com/<owner>/<repo>/blob/<branch>/<path>` | Must include `blob/<branch>/<path>` |

- **owner**: GitHub username or org
- **repo**: Repository name
- **branch**: Branch name, e.g. `main`, `master`
- **path**: Path inside the repo; omit for root

### Important: URL must include `tree/<branch>`

When you open a repo in the browser, the address bar often does **not** show `tree/main`, e.g.:

- What you see: `https://github.com/wmt-conference/wmt25-terminology`
- What this extension needs: `https://github.com/wmt-conference/wmt25-terminology/tree/main`

**Manually append `/tree/main`** (or `/tree/your-branch`) to the repo URL so the extension can parse it as a directory and list all files. If you only paste `https://github.com/owner/repo`, behavior may differ; it’s best to **always include `/tree/main`** when pasting into GoPeed.

For a single file, use a URL with **`blob/<branch>/path`** (the URL when you open a file on GitHub).

---

### Get a GitHub Token (recommended)

Without a token, unauthenticated requests are limited to about **60 per hour per IP**; exceeding that returns **403 API rate limit exceeded** and parsing fails. With a token you get about **5000/hour** and can access private repos. The token is for **HTTPS/API**, not SSH (SSH uses your local keys).

**Steps:**

1. Open [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) (or go to <https://github.com/settings/tokens>).
2. Click **Generate new token** → **Generate new token (classic)**.
3. Set a note (e.g. `GoPeed extension`), check **repo** (or **public_repo** if you only need public repos).
4. Generate and **copy** the token (shown once; store it safely).
5. In GoPeed: **Extensions** → find “GitHub 仓库下载” → **Settings** → paste the token in **GitHub Token** and save.

---

### Examples

1. Download all files at root of `wmt-conference/wmt25-terminology`:  
   `https://github.com/wmt-conference/wmt25-terminology/tree/main`

2. Download the `ranking` directory:  
   `https://github.com/wmt-conference/wmt25-terminology/tree/main/ranking`

3. Download single file `README.md`:  
   `https://github.com/wmt-conference/wmt25-terminology/blob/main/README.md`

---

## Development

1. **Icon**: Put `icon.png` (e.g. 128×128) in `assets/`, or copy from `gopeed-extension-huggingface/assets/icon.png`.
2. Build and debug:

```bash
npm install
npm run dev   # watch build; use with GoPeed developer mode
npm run build # production build
```

---

## Notes

- Files over 100MB using Git LFS are treated as normal files; you may get LFS pointer files instead of content. LFS support may be added later.
- Only `github.com` and `www.github.com` URLs are supported.

### Troubleshooting “only one file (main)” or “API rate limit”

1. **Confirm this extension is handling the URL**: After parsing, the task name should be **“GitHub: repo-name”**. If it shows “Error: API 限流，请在扩展设置中配置 GitHub Token”, you hit the rate limit—configure a token as above.
2. **Ensure the URL has `tree/<branch>`**: Root or subdir URLs must include `tree/main` (or the branch name).
3. **Check extension log**: In GoPeed’s install directory, open `logs/extension.log` for `[GitHub 扩展] 收到 URL:` and `[GitHub Parser]` messages.
4. **Disable other GitHub extensions**: If another extension also matches `*://github.com/*`, it may run first; disable others and try again.

---

## License

ISC
