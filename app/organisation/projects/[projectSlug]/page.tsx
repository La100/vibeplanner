import { redirect } from "next/navigation";


export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params;
  redirect(`/organisation/projects/${projectSlug}/dashboard`);
}
