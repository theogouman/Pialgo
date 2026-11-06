import { redirect } from "next/navigation";
import { DocumentsView } from "@/components/documents-view";
import { getSession } from "@/lib/server/session";
import { isNotionConfigured, listDocuments, type DocumentItem } from "@/lib/server/notion";
import { DEMO_DOCS, demoEnabled } from "@/lib/server/demo";

export const metadata = { title: "Documents · SCI Pialgo" };

export default async function DocumentsPage() {
  // Le layout vérifie aussi la session ; la page la revérifie avant d'interroger Notion.
  if (!(await getSession())) redirect("/login");

  let documents: DocumentItem[] = [];
  let error: string | null = null;
  if (demoEnabled()) {
    documents = DEMO_DOCS;
  } else if (!isNotionConfigured()) {
    error = "La connexion à Notion n'est pas configurée (NOTION_TOKEN).";
  } else {
    try {
      documents = await listDocuments();
    } catch (err) {
      console.error("[notion]", err);
      error = "Impossible de récupérer les documents depuis Notion. Réessayez dans un instant.";
    }
  }

  return <DocumentsView documents={documents} error={error} />;
}
