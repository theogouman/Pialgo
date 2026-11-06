import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/server/session";
import { personName } from "@/lib/people";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell userName={personName(session.personId)}>{children}</AppShell>;
}
