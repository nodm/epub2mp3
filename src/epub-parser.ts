import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import AdmZip from "adm-zip";
import { parseDocument } from "htmlparser2";
import type { BookMetadata, Language, ParsedBook, TextBlock } from "./types.js";

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
};

type TocEntry = {
  href: string;
  title: string;
};

export function parseEpub(filePath: string): ParsedBook {
  const data = readFileSync(filePath);
  return parseEpubBuffer(data);
}

export function parseEpubBuffer(data: Buffer): ParsedBook {
  const zip = new AdmZip(data);

  const opfPath = findOpfPath(zip);
  const opfDir = dirname(opfPath);
  const opfXml = readEntry(zip, opfPath);
  const opfDoc = parseDocument(opfXml);

  const metadata = extractMetadata(opfDoc);
  const manifest = extractManifest(opfDoc);
  const spineIds = extractSpine(opfDoc);

  const navItem = manifest.find((item) => item.properties?.includes("nav"));
  const toc = navItem ? extractNavToc(zip, resolvePath(opfDir, navItem.href)) : [];

  const blocks: TextBlock[] = [];
  for (let i = 0; i < spineIds.length; i++) {
    const item = manifest.find((m) => m.id === spineIds[i]);
    if (!item) continue;

    const contentPath = resolvePath(opfDir, item.href);
    const xhtml = readEntry(zip, contentPath);
    const chapterTitle = findTocTitle(toc, item.href) ?? undefined;
    const paragraphs = extractTextFromXhtml(xhtml);

    for (const text of paragraphs) {
      blocks.push({ chapterIndex: i, chapterTitle, text });
    }
  }

  return { metadata, blocks };
}

function findOpfPath(zip: AdmZip): string {
  const containerXml = readEntry(zip, "META-INF/container.xml");
  const doc = parseDocument(containerXml);
  const rootfile = findElement(doc, "rootfile");
  if (!rootfile) throw new Error("No rootfile found in container.xml");

  const fullPath = rootfile.attribs["full-path"];
  if (!fullPath) throw new Error("rootfile missing full-path attribute");
  return fullPath;
}

function extractMetadata(opfDoc: ReturnType<typeof parseDocument>): BookMetadata {
  const title = getElementText(opfDoc, "dc:title") ?? getElementText(opfDoc, "title") ?? "Unknown";
  const author =
    getElementText(opfDoc, "dc:creator") ?? getElementText(opfDoc, "creator") ?? "Unknown";
  const langRaw =
    getElementText(opfDoc, "dc:language") ?? getElementText(opfDoc, "language") ?? "en";

  const lang = langRaw.split("-")[0].toLowerCase();
  const validLangs = new Set(["en", "uk", "ru"]);
  const language: Language = validLangs.has(lang) ? (lang as Language) : "en";

  return { title, author, language };
}

function extractManifest(opfDoc: ReturnType<typeof parseDocument>): ManifestItem[] {
  const items: ManifestItem[] = [];
  walkElements(opfDoc, (el) => {
    if (el.name === "item" && el.attribs.id && el.attribs.href) {
      items.push({
        id: el.attribs.id,
        href: el.attribs.href,
        mediaType: el.attribs["media-type"] ?? "",
        properties: el.attribs.properties,
      });
    }
  });
  return items;
}

function extractSpine(opfDoc: ReturnType<typeof parseDocument>): string[] {
  const ids: string[] = [];
  walkElements(opfDoc, (el) => {
    if (el.name === "itemref" && el.attribs.idref) {
      ids.push(el.attribs.idref);
    }
  });
  return ids;
}

function extractNavToc(zip: AdmZip, navPath: string): TocEntry[] {
  const xhtml = readEntry(zip, navPath);
  const doc = parseDocument(xhtml);
  const entries: TocEntry[] = [];

  walkElements(doc, (el) => {
    if (el.name === "a" && el.attribs.href) {
      const text = getTextContent(el).trim();
      if (text) {
        entries.push({ href: el.attribs.href.split("#")[0], title: text });
      }
    }
  });

  return entries;
}

function extractTextFromXhtml(xhtml: string): string[] {
  const doc = parseDocument(xhtml);
  const paragraphs: string[] = [];
  const textTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6"]);

  walkElements(doc, (el) => {
    if (textTags.has(el.name)) {
      const text = getTextContent(el).trim();
      if (text) paragraphs.push(text);
    }
  });

  return paragraphs;
}

// --- DOM helpers ---

// biome-ignore lint/suspicious/noExplicitAny: htmlparser2 node types are complex; using any for DOM traversal
type AnyNode = any;

function walkElements(node: AnyNode, callback: (el: AnyNode) => void) {
  if (node.children) {
    for (const child of node.children) {
      if (child.name) {
        callback(child);
      }
      if (child.children) {
        walkElements(child, callback);
      }
    }
  }
}

function findElement(node: AnyNode, tagName: string): AnyNode | null {
  let result: AnyNode | null = null;
  walkElements(node, (el) => {
    if (!result && el.name === tagName) result = el;
  });
  return result;
}

function getElementText(node: AnyNode, tagName: string): string | null {
  const el = findElement(node, tagName);
  if (!el) return null;
  const text = getTextContent(el).trim();
  return text || null;
}

function getTextContent(node: AnyNode): string {
  if (typeof node.data === "string") return node.data;
  if (node.children) {
    return node.children.map(getTextContent).join("");
  }
  return "";
}

// --- Utility ---

function readEntry(zip: AdmZip, path: string): string {
  const entry = zip.getEntry(path);
  if (!entry) throw new Error(`Entry not found in EPUB: ${path}`);
  return entry.getData().toString("utf-8");
}

function resolvePath(baseDir: string, href: string): string {
  if (baseDir === ".") return href;
  return posix.join(baseDir, href);
}

function findTocTitle(toc: TocEntry[], href: string): string | null {
  const basename = href.split("/").pop() ?? href;
  const entry = toc.find((e) => e.href === href || e.href === basename);
  return entry?.title ?? null;
}
