import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/server/session";
import { isNotionConfigured, listDocuments, type DocumentItem } from "@/lib/server/notion";
import { personName } from "@/lib/people";
import { DEMO_DOCS, demoEnabled } from "@/lib/server/demo";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

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

  return <Dashboard userName={personName(session.personId)} documents={documents} error={error} />;
}
