import { NextResponse, type NextRequest } from "next/server";
import {
  SCIM_SCHEMA_SP_CONFIG,
  authenticateScim,
  getScimBaseUrl,
  scimJson,
  scimRootUrl,
} from "@/lib/scim";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization")) {
    const auth = await authenticateScim(req);
    if (auth instanceof NextResponse) return auth;
  }

  const baseUrl = getScimBaseUrl(req);
  const root = scimRootUrl(baseUrl);

  return scimJson(
    {
      schemas: [SCIM_SCHEMA_SP_CONFIG],
      documentationUri: `${baseUrl}/support/api-reference`,
      patch: {
        supported: true,
      },
      bulk: {
        supported: false,
        maxOperations: 0,
        maxPayloadSize: 0,
      },
      filter: {
        supported: true,
        maxResults: 200,
      },
      changePassword: {
        supported: false,
      },
      sort: {
        supported: false,
      },
      etag: {
        supported: false,
      },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication scheme using the OAuth Bearer Token Standard",
          specUri: "http://www.rfc-editor.org/info/rfc6750",
          primary: true,
        },
      ],
      meta: {
        location: `${root}/ServiceProviderConfig`,
        resourceType: "ServiceProviderConfig",
      },
    },
    200
  );
}
