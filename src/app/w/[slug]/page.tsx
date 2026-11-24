import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { workspaceLogoUrl } from "@/lib/logo";
import { StaffLogin } from "@/components/staff-login";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: ws ? `${ws.name} staff sign in` : "Staff sign in", robots: { index: false, follow: false } };
}

export default async function WorkspaceLogin({ params }: { params: { slug: string } }) {
  const ws = await prisma.workspace.findUnique({ where: { slug: params.slug }, select: { id: true, name: true, suspendedAt: true, logoUpdatedAt: true } });
  if (!ws) notFound();
  return <StaffLogin workspaceId={ws.id} name={ws.name} logoUrl={workspaceLogoUrl(ws)} onCustomDomain={false} />;
}
