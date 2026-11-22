export type EmbedField = { name: string; value: string; inline?: boolean };
export type Embed = { title: string; description?: string; color?: number; fields?: EmbedField[]; footer?: string };

export const COLORS = { info: 0x1d4ed8, ok: 0x059669, warn: 0xd97706, danger: 0xe11d48 };

/** Microsoft Teams: classic connectors (office.com) and Workflows webhooks (logic.azure.com, powerplatform.com). */
function isTeamsHost(h: string) {
  return h.endsWith(".webhook.office.com") || h === "outlook.office.com" || h.endsWith(".logic.azure.com") || h.endsWith(".powerplatform.com");
}

function isTeams(url: string) {
  try {
    return isTeamsHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function teamsBody(embed: Embed, url: string) {
  const facts = (embed.fields ?? []).map((f) => ({ title: f.name, value: f.value }));
  if (new URL(url).hostname.endsWith("office.com")) {
    return { "@type": "MessageCard", "@context": "http://schema.org/extensions", summary: embed.title, themeColor: (embed.color ?? COLORS.info).toString(16).padStart(6, "0"), title: embed.title, text: embed.description ?? "", sections: facts.length ? [{ facts: facts.map((f) => ({ name: f.title, value: f.value })) }] : [] };
  }
  return {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: { type: "AdaptiveCard", version: "1.4", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", body: [{ type: "TextBlock", text: embed.title, weight: "Bolder", size: "Medium", wrap: true }, ...(embed.description ? [{ type: "TextBlock", text: embed.description, wrap: true }] : []), ...(facts.length ? [{ type: "FactSet", facts }] : [])] } }],
  };
}

function isSlack(url: string) {
  try {
    return new URL(url).hostname.endsWith("slack.com");
  } catch {
    return false;
  }
}

export function validWebhookUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (/(^|\.)discord(app)?\.com$/.test(u.hostname) || u.hostname.endsWith("slack.com") || isTeamsHost(u.hostname));
  } catch {
    return false;
  }
}

/** Sends one embed. Never throws; returns ok/error so callers can record failures. */
export async function sendEmbed(url: string | null | undefined, embed: Embed): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: "No webhook configured" };
  if (!validWebhookUrl(url)) return { ok: false, error: "Webhook URL must be an https Discord, Slack or Microsoft Teams URL" };
  try {
    const body = isTeams(url)
      ? teamsBody(embed, url)
      : isSlack(url)
      ? {
          text: `*${embed.title}*${embed.description ? `\n${embed.description}` : ""}${(embed.fields ?? []).map((f) => `\n• ${f.name}: ${f.value}`).join("")}`,
        }
      : {
          embeds: [
            {
              title: embed.title,
              description: embed.description,
              color: embed.color ?? COLORS.info,
              fields: embed.fields,
              footer: { text: embed.footer ?? "OnboardOps" },
              timestamp: new Date().toISOString(),
            },
          ],
        };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: `Webhook responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Webhook request failed" };
  }
}
