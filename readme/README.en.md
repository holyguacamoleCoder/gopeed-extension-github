# gopeed-extension-github

[简体中文](../README.md) | [English](readme/README.en.md)

Gopeed extension for downloading GitHub repositories: parse repo directories and batch-download files. Suited for large datasets and experiment data.

I built this because cloning a multi-GB dataset repo with `git clone` was too slow. With this extension, Gopeed parses the directory and downloads files with multiple concurrent tasks—more stable than a full clone and with better resume support. This extension was created by adapting [gopeed-extension-huggingface](https://github.com/DSYZayn/gopeed-extension-huggingface); the structure is the same, with the parsing target switched from Hugging Face to the GitHub API and supporting Git LFS.

## Features

- **Repo root** and **subdirectories** under a branch/tag
- **Single file** (blob URL) download
- **Releases** assets, **Archive** packages (zip/tar.gz), **Gist**, and **raw.githubusercontent.com** direct links
- Optional **download proxy**: wraps final download URLs only, not GitHub API calls; prefix is user-configured (see [ghproxy.link](https://ghproxy.link/) for available endpoints)
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
| Repo root    | `https://github.com/<owner>/<repo>/tree/<branch>`        | Must include `tree/<branch>`; or paste `.../<owner>/<repo>` only — extension defaults to **`main`** |
| Subdirectory | `https://github.com/<owner>/<repo>/tree/<branch>/<path>` | `<path>` = path inside repo         |
| Single file  | `https://github.com/<owner>/<repo>/blob/<branch>/<path>` | Must include `blob/<branch>/<path>` |
| Releases     | `https://github.com/<owner>/<repo>/releases`             | Latest release assets               |
| Release tag  | `https://github.com/<owner>/<repo>/releases/tag/<tag>`   | Assets for a specific tag; `.../releases/expanded_assets/<tag>` also works |
| Archive      | `https://github.com/<owner>/<repo>/archive/refs/heads/main.zip` | Single archive download      |
| Gist         | `https://gist.github.com/<user>/<gist_id>`               | All files in the gist               |
| Raw link     | `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` | Single file download        |

- **owner**: GitHub username or org
- **repo**: Repository name
- **branch**: Branch or tag, e.g. `main`, `v1.0`. If the branch name contains slashes (e.g. `njpm/tsdb-utf8-mixed-querying`), copy the full `tree/...` URL from GitHub
- **path**: Path inside the repo; omit for root

### Unsupported pages

These **cannot** be resolved as download tasks. Use a supported URL format from the table above:

- Issues, Pull requests, Discussions, Actions, Projects, Wiki, Security, Insights
- Compare, Commits (list), etc.

### Important: `tree/<branch>` is optional (defaults to main)

When you open a repo in the browser, the address bar often does **not** show `tree/main`, e.g.:

- What you see: `https://github.com/wmt-conference/wmt25-terminology`
- Equivalent: `https://github.com/wmt-conference/wmt25-terminology/tree/main`

**If you paste only `https://github.com/owner/repo` (without `tree`), the extension parses the repo root using the `main` branch automatically.** If the default branch is not `main`, use `/tree/your-branch` explicitly.

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

### Download proxy (optional)

Enable **启用下载代理** in extension settings and set **代理前缀** to a proxy base URL ending with `/` (see [ghproxy.link](https://ghproxy.link/) for available endpoints). When enabled, final download URLs (raw, LFS, release assets, archive, gist) are prefixed; **GitHub API requests are never proxied**.

- Useful when GitHub is slow from your region
- Third-party proxies are at your own risk; if private repos or LFS fail through a proxy, disable it and retry

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

5. Download release assets:  
   `https://github.com/GopeedLab/gopeed/releases`

6. Download main branch as zip:  
   `https://github.com/owner/repo/archive/refs/heads/main.zip`

### Quick test URLs (Archive / Gist / Releases)

| Type | URL to paste |
| ---- | ------------ |
| Archive | `https://github.com/octocat/Hello-World/archive/refs/heads/master.zip` |
| Gist | `https://gist.github.com/af855a8c9af9c424038c9b7eccda27ca` |
| Releases (latest) | `https://github.com/GopeedLab/gopeed/releases` |
| Releases (tag) | `https://github.com/GopeedLab/gopeed/releases/tag/v1.6.2` |

---

### Notes (many files / resolve timeout)

- Very large repositories may need to fetch the full file tree metadata; parsing can be slow or hit Gopeed’s resolve timeout.
- Prefer `tree/<branch>/<subpath>` over the repo root when possible, and use a **token** to reduce rate-limit failures.

---

## Notes

- **Git LFS**: the extension detects LFS pointers and uses GitHub’s LFS Batch API to get real download URLs. Public repo LFS works without a token; private LFS needs a token. If an LFS object is missing on the server (e.g. only the pointer was committed), the file is labeled **LFS: Object missing (LFS pointer only)** and the task name may include **(LFS unresolved)**. LFS downloads through a proxy may fail; disable the proxy and retry.
- Supports `github.com`, `raw.githubusercontent.com`, `gist.github.com`, and `gist.githubusercontent.com`.
- User-visible errors and LFS labels are in **English**.
- **API rate limit**: if parsing fails with **API rate limit exceeded**, configure a GitHub token as above and retry.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=holyguacamoleCoder/gopeed-extension-github&type=date&legend=top-left)](https://www.star-history.com/#holyguacamoleCoder/gopeed-extension-github&type=date&legend=top-left)
