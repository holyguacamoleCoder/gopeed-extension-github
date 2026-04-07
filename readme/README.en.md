# gopeed-extension-github

[简体中文](../README.md) | [English](readme/README.en.md)

Gopeed extension for downloading GitHub repositories: parse repo directories and batch-download files. Suited for large datasets and experiment data.

I built this because cloning a multi-GB dataset repo with `git clone` was too slow. With this extension, Gopeed parses the directory and downloads files with multiple concurrent tasks—more stable than a full clone and with better resume support. This extension was created by adapting [gopeed-extension-huggingface](https://github.com/DSYZayn/gopeed-extension-huggingface); the structure is the same, with the parsing target switched from Hugging Face to the GitHub API and supporting Git LFS.

## Features

- **Repo root** and **subdirectories** under a branch/tag
- **Single file** (blob URL) download
- **Git LFS**: detects LFS pointer files and resolves them to real object download URLs (GitHub Batch API); list shows **real file sizes** from pointer metadata, not pointer file size
- **Metadata**: both root and subdirectories use the Git **Tree API** (`commits` + `git/trees`) to build the file list, then filter by path inside the repo; if a response is **truncated**, the extension falls back to non-recursive tree fetch and walks subtrees per GitHub’s guidance
- **Branch names with slashes** (e.g. `feature/foo`): use the full `tree/...` URL from the browser; the extension resolves `ref` vs path via the GitHub API
- Optional **GitHub Token**: higher API rate limit (5000/hr), access to private repos and private LFS

## Install

On the Gopeed extensions page, enter this repo’s clone URL, e.g.:

```
https://github.com/holyguacamoleCoder/gopeed-extension-github
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
- **branch**: Branch or tag, e.g. `main`, `v1.0`. If the branch name contains slashes (e.g. `njpm/tsdb-utf8-mixed-querying`), copy the full `tree/...` URL from GitHub
- **path**: Path inside the repo; omit for root

### Unsupported pages

These **cannot** be resolved as download tasks (URLs whose third path segment is not `tree` or `blob` are rejected). Use the repo home or a `tree` / `blob` link instead:

- Issues, Pull requests, Discussions, Actions, Projects, Wiki, Security, Insights
- Releases (list), Tags (list), Compare, Commits (list), etc.

### Important: URL must include `tree/<branch>`

When you open a repo in the browser, the address bar often does **not** show `tree/main`, e.g.:

- What you see: `https://github.com/wmt-conference/wmt25-terminology`
- What this extension needs: `https://github.com/wmt-conference/wmt25-terminology/tree/main`

**Manually append `/tree/main`** (or `/tree/your-branch`) to the repo URL so the extension can parse it as a directory and list all files. If you only paste `https://github.com/owner/repo`, behavior may differ; it’s best to **always include `/tree/main`** when pasting into Gopeed.

For a single file, use a URL with **`blob/<branch>/path`** (the URL when you open a file on GitHub).

Pathnames are normalized (duplicate slashes collapsed, empty segments dropped), so `.../tree/main` and `.../tree/main/` are usually equivalent.

---

### Get a GitHub Token (recommended)

Without a token, unauthenticated requests are limited to about **60 per hour per IP**; exceeding that returns **403 API rate limit exceeded** and parsing fails. With a token you get about **5000/hour** and can access private repos. The token is for **HTTPS/API**, not SSH (SSH uses your local keys).

**Steps:**

1. Open [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) (or go to <https://github.com/settings/tokens>).
2. Click **Generate new token** → **Generate new token (classic)**.
3. Set a note (e.g. `Gopeed extension`), check **repo** (or **public_repo** if you only need public repos).
4. Generate and **copy** the token (shown once; store it safely).
5. In Gopeed: **Extensions** → find “GitHub 仓库下载” → **Settings** → paste the token in **GitHub Token** and save.

---

### Examples

1. Download all files at root of `wmt-conference/wmt25-terminology`:  
   `https://github.com/wmt-conference/wmt25-terminology/tree/main`

2. Download the `ranking` directory:  
   `https://github.com/wmt-conference/wmt25-terminology/tree/main/ranking`

3. Download single file `README.md`:  
   `https://github.com/wmt-conference/wmt25-terminology/blob/main/README.md`

4. Repo with **Git LFS** (resolved to real file downloads):  
   `https://github.com/Zhangyanshen/lfs-test/tree/master`

---

### Notes (many files / resolve timeout)

- Repositories with **a very large number of files** may need to fetch **the full tree metadata** in one (or several) API calls; the HTTP response can be **large and slow**.
- **Gopeed may enforce a total timeout** for extension resolve. You might see **timeout or failure in the UI** while **logs show the HTTP response arriving slightly later**—the host gave up before the request finished. **Retry with a deeper subdirectory URL** (`tree/<branch>/<subpath>`) to reduce work.
- Prefer **`tree/<branch>/<subpath>`** over repo root when possible, and use a **token** to reduce rate-limit retries.

---

## Development

1. **Icon**: Put `icon.png` (e.g. 128×128) in `assets/`, or copy from `gopeed-extension-huggingface/assets/icon.png`.
2. Build and debug:

```bash
npm install
npm run dev   # watch build; use with Gopeed developer mode
npm run build # production build
```

---

## Notes

- **Git LFS**: the extension detects LFS pointers and uses GitHub’s LFS Batch API to get real download URLs. Public repo LFS works without a token; private LFS needs a token. If an LFS object is missing on the server (e.g. only the pointer was committed), the file is labeled **LFS: Object missing (LFS pointer only)** and the task name may include **(LFS unresolved)**.
- Only `github.com` and `www.github.com` URLs are supported.
- User-visible errors and LFS labels are in **English**.

### Troubleshooting “only one file (main)” or “API rate limit”

1. **Confirm this extension is handling the URL**: After parsing, the task name should be **“GitHub: repo-name”**. If it starts with **Error: API rate limit exceeded**, configure a token as above.
2. **Ensure the URL has `tree/<branch>`**: Root or subdir URLs must include `tree/main` (or the branch name).
3. **Check extension log**: In GoPeed’s install directory, open `logs/extension.log` for `[GitHub 扩展] 收到 URL:` and `[GitHub Parser]` messages.
4. **Disable other GitHub extensions**: If another extension also matches `*://github.com/*`, it may run first; disable others and try again.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=holyguacamoleCoder/gopeed-extension-github&type=date&legend=top-left)](https://www.star-history.com/#holyguacamoleCoder/gopeed-extension-github&type=date&legend=top-left)
