import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/server/session";
import { getFileSource } from "@/lib/server/notion";
import { demoEnabled, demoFile } from "@/lib/server/demo";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Proxy authentifié vers les fichiers Notion : les URL Notion expirent au bout d'une
 * heure et ne doivent pas être exposées. ?download=1 force le téléchargement.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ pageId: string; index: string }> }) {
  if (!(await getSession())) return new NextResponse("Non autorisé", { status: 401 });
  const { pageId, index } = await ctx.params;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) return new NextResponse("Introuvable", { status: 404 });

  if (demoEnabled()) {
    const demo = demoFile(pageId, i);
    return demo ? NextResponse.redirect(new URL(demo.path, req.url)) : new NextResponse("Introuvable", { status: 404 });
  }

  const source = await getFileSource(pageId, i);
  if (!source) return new NextResponse("Introuvable", { status: 404 });

  const upstream = await fetch(source.url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new NextResponse("Fichier indisponible", { status: 502 });

  const download = req.nextUrl.searchParams.get("download") === "1";
  const type = MIME[source.ext] ?? upstream.headers.get("content-type") ?? "application/octet-stream";
  const filename = encodeURIComponent(source.name);
  const headers = new Headers({
    "Content-Type": type,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new NextResponse(upstream.body, { headers });
}
