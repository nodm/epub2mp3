# EPUB Format Reference

How epub2mp3 parses EPUB files, and what EPUB structures are supported.

## EPUB structure

An EPUB file is a ZIP archive with a specific layout:

```
book.epub (ZIP)
├── mimetype                          # "application/epub+zip" (uncompressed)
├── META-INF/
│   └── container.xml                 # Points to the OPF file
└── OEBPS/                            # (or any directory)
    ├── content.opf                   # Package document (manifest + spine)
    ├── nav.xhtml                     # Navigation document (EPUB 3 TOC)
    ├── chapter1.xhtml                # Content documents
    ├── chapter2.xhtml
    └── ...
```

## Parse sequence

### 1. Find the OPF file

`META-INF/container.xml` contains a `<rootfile>` element with the `full-path` attribute pointing to the OPF:

```xml
<container>
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf"
              media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
```

### 2. Extract metadata from OPF

The `<metadata>` section contains Dublin Core elements:

```xml
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Book Title</dc:title>
  <dc:creator>Author Name</dc:creator>
  <dc:language>uk</dc:language>
</metadata>
```

**Mapped to:** `BookMetadata { title, author, language }`

**Language handling:** The raw value (e.g., `en-US`, `uk`, `ru-RU`) is split at `-` and the first segment is taken. If it doesn't match `en`, `uk`, or `ru`, defaults to `en`.

### 3. Build reading order from spine

The `<manifest>` maps item IDs to file paths:

```xml
<manifest>
  <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  <item id="nav" href="nav.xhtml" properties="nav"/>
</manifest>
```

The `<spine>` defines reading order:

```xml
<spine>
  <itemref idref="ch1"/>
  <itemref idref="ch2"/>
</spine>
```

The parser iterates spine items in order, resolving each `idref` against the manifest to get the XHTML file path.

### 4. Extract chapter titles from NAV

If a manifest item has `properties="nav"`, it's the EPUB 3 navigation document. The parser looks for `<a>` elements inside `<nav epub:type="toc">` and maps them by `href` to chapter titles.

```xml
<nav epub:type="toc">
  <ol>
    <li><a href="chapter1.xhtml">Chapter One</a></li>
    <li><a href="chapter2.xhtml">Chapter Two</a></li>
  </ol>
</nav>
```

**Matching:** The `href` is compared against the manifest item's `href` (both full path and basename).

### 5. Extract text from XHTML

For each spine item, the XHTML content is parsed with `htmlparser2`. Text is extracted from these elements:

- `<p>` — paragraphs
- `<h1>` through `<h6>` — headings

Each element produces one `TextBlock` with:
- `chapterIndex`: position in the spine (0-based)
- `chapterTitle`: from the NAV TOC (if found)
- `text`: concatenated text content of the element

## What's NOT extracted

- **Images** (`<img>`, `<svg>`) — skipped entirely
- **Tables** (`<table>`) — not extracted (table text can be garbled when read aloud)
- **Footnotes/endnotes** — no special handling; they appear as regular text if inline
- **CSS/styling** — ignored
- **Audio/video** — ignored
- **Nested sections** — not recursed; only top-level text elements within each XHTML file

## Supported EPUB versions

| Feature | EPUB 2 | EPUB 3 |
|---------|--------|--------|
| OPF manifest + spine | Yes | Yes |
| NAV TOC (`<nav epub:type="toc">`) | No (uses NCX) | Yes |
| NCX TOC | Not implemented | N/A |
| XHTML content | Yes | Yes |

**Note:** EPUB 2 books using NCX for navigation will parse correctly but **chapter titles will be missing** (the parser only reads EPUB 3 NAV). The text content itself is unaffected.

## Edge cases

**Multiple `<body>` elements per XHTML:** Only the first body's content is extracted (this matches browser behavior).

**Namespace prefixes:** The parser uses `htmlparser2` which doesn't require namespace-aware parsing. Elements like `<xhtml:p>` or `<dc:title>` are matched by their local name.

**Nested directories:** EPUB content may be in nested subdirectories. The parser resolves all paths relative to the OPF file's directory using `posix.join()`.

**Empty chapters:** XHTML files with no `<p>` or `<h1>`–`<h6>` elements produce zero text blocks. These chapters are effectively skipped in the output.
