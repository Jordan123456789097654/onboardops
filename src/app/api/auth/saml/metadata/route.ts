import { prisma } from "@/lib/prisma";
import { buildSpMetadataXml } from "@/lib/saml";

export const dynamic = "force-dynamic";

/**
 * Returns SAML 2.0 Service Provider Metadata XML for a workspace (`?ws=<workspaceId>`).
 * Give this URL or downloaded XML to Okta, Ping Identity, OneLogin, or ADFS.
 */
export async function GET(req: Request) {
  const ws = (new URL(req.url).searchParams.get("ws") ?? "").trim();
  if (!ws || !/^[a-zA-Z0-9_-]{3,64}$/.test(ws)) {
    return new Response("Missing or invalid workspace parameter (?ws=<workspaceId>).", { status: 400 });
  }
  const exists = await prisma.workspace.findUnique({ where: { id: ws }, select: { id: true } });
  if (!exists) {
    return new Response("Workspace not found.", { status: 404 });
  }
  const xml = buildSpMetadataXml(ws);
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/samlmetadata+xml; charset=utf-8",
      "content-disposition": `inline; filename="onboardops-saml-metadata-${ws}.xml"`,
      "cache-control": "public, max-age=300",
    },
  });
}
