"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Info, Loader2, Sparkles } from "lucide-react";
import {
  draftCaseStudyAction,
  draftChangelogPostsAction,
  draftIndustryLandingAction,
  type CaseStudyDraft,
  type ChangelogChannel,
  type ChangelogPostsDraft,
  type IndustryLandingDraft,
} from "@/actions/admin-ai";
import { Empty, Field, PageHeader, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export type StudioRelease = {
  v: string;
  date: string;
  highlight: string;
  items: string[];
};

export type StudioTestimonial = {
  id: string;
  quote: string;
  name: string;
  jobTitle: string;
  company: string;
  rating: number | null;
  visible: boolean;
};

const INDUSTRY_PRESETS = [
  "Warehousing & logistics",
  "Restaurants & quick-service",
  "Retail & multi-site stores",
  "Senior care & assisted living",
  "Cleaning & facility services",
];

function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("ok", "Copied to clipboard.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("error", "Could not access clipboard. Select and copy the text manually.");
    }
  }

  return (
    <button type="button" onClick={() => void onCopy()} className={cn("btn !h-7 !text-xs", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

export function ContentStudio({
  releases,
  testimonials,
  ai,
}: {
  releases: StudioRelease[];
  testimonials: StudioTestimonial[];
  ai: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("changelog");

  /* ---- Tab 1: Changelog -> Posts ---- */
  const [version, setVersion] = useState(releases[0]?.v ?? "");
  const [channel, setChannel] = useState<ChangelogChannel>("all");
  const [changelogNotes, setChangelogNotes] = useState("");
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogDraft, setChangelogDraft] = useState<ChangelogPostsDraft | null>(null);

  const selectedRelease = useMemo(() => releases.find((r) => r.v === version) ?? null, [releases, version]);

  /* ---- Tab 2: Industry Landing Page ---- */
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [landingLoading, setLandingLoading] = useState(false);
  const [landingDraft, setLandingDraft] = useState<IndustryLandingDraft | null>(null);
  const [landingView, setLandingView] = useState<"preview" | "markdown">("preview");

  /* ---- Tab 3: Testimonial -> Case Study ---- */
  const [testimonialId, setTestimonialId] = useState(testimonials[0]?.id ?? "");
  const [caseContext, setCaseContext] = useState("");
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseDraft, setCaseDraft] = useState<CaseStudyDraft | null>(null);
  const [caseView, setCaseView] = useState<"preview" | "markdown">("preview");

  const selectedTestimonial = useMemo(
    () => testimonials.find((t) => t.id === testimonialId) ?? null,
    [testimonials, testimonialId]
  );

  async function generateChangelog() {
    if (!version || changelogLoading) return;
    setChangelogLoading(true);
    try {
      const res = await draftChangelogPostsAction({
        version,
        channel,
        extraNotes: changelogNotes.trim() || undefined,
      });
      if (res.ok) {
        setChangelogDraft(res.data);
        toast("ok", `Drafted release posts for v${res.data.version}.`);
      } else {
        toast("error", res.error);
      }
    } finally {
      setChangelogLoading(false);
    }
  }

  async function generateLanding() {
    if (industry.trim().length < 2 || landingLoading) return;
    setLandingLoading(true);
    try {
      const res = await draftIndustryLandingAction({
        industry: industry.trim(),
        teamSize: teamSize.trim() || undefined,
        painPoints: painPoints.trim() || undefined,
      });
      if (res.ok) {
        setLandingDraft(res.data);
        setLandingView("preview");
        toast("ok", `Drafted landing page for ${res.data.industry}.`);
      } else {
        toast("error", res.error);
      }
    } finally {
      setLandingLoading(false);
    }
  }

  async function generateCaseStudy() {
    if (!testimonialId || caseLoading) return;
    setCaseLoading(true);
    try {
      const res = await draftCaseStudyAction({
        testimonialId,
        extraContext: caseContext.trim() || undefined,
      });
      if (res.ok) {
        setCaseDraft(res.data);
        setCaseView("preview");
        toast("ok", "Mini case study draft ready.");
      } else {
        toast("error", res.error);
      }
    } finally {
      setCaseLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Content studio"
        sub="Turn changelog releases, target industries, and customer testimonials into ready-to-edit copy."
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-line bg-muted/60 px-3.5 py-2.5 text-[13px] text-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          <strong className="font-medium text-ink">Staff-only drafts to copy &amp; edit.</strong> Nothing here is ever published automatically.
        </span>
      </div>

      {!ai ? (
        <Empty
          title="AI is not configured"
          hint="Set GROQ_API_KEYS in the server environment to generate content drafts here."
        />
      ) : (
        <div className="space-y-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "changelog", label: "Changelog → Posts" },
              { id: "landing", label: "Industry Landing Page" },
              { id: "case-study", label: "Testimonial → Case Study" },
            ]}
          />

          {/* ==================== TAB 1: CHANGELOG -> POSTS ==================== */}
          {tab === "changelog" && (
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <div className="card h-fit space-y-4 p-4">
                <Field label="Release version">
                  <select className="input" value={version} onChange={(e) => setVersion(e.target.value)}>
                    {releases.map((r) => (
                      <option key={r.v} value={r.v}>
                        v{r.v} ({r.date}) — {r.highlight.slice(0, 52)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target channel">
                  <select
                    className="input"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as ChangelogChannel)}
                  >
                    <option value="all">All channels (LinkedIn, X, Facebook, Email)</option>
                    <option value="linkedin">LinkedIn only</option>
                    <option value="x">X / Twitter only</option>
                    <option value="facebook">Facebook only</option>
                    <option value="email">Email newsletter only</option>
                  </select>
                </Field>

                <Field label="Optional angle or extra notes">
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={1000}
                    placeholder="e.g., Emphasize time saved for warehouse managers or highlight free beta access."
                    value={changelogNotes}
                    onChange={(e) => setChangelogNotes(e.target.value)}
                  />
                </Field>

                {selectedRelease && (
                  <div className="rounded-md border border-line bg-muted/50 p-3 text-xs">
                    <div className="mono mb-1 font-medium text-ink">
                      v{selectedRelease.v} · {selectedRelease.date}
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-soft">
                      {selectedRelease.items.slice(0, 4).map((it, i) => (
                        <li key={i} className="line-clamp-2">{it}</li>
                      ))}
                      {selectedRelease.items.length > 4 && (
                        <li className="list-none -ml-4 text-[11px] text-soft/80">
                          + {selectedRelease.items.length - 4} more changelog item(s) included in context
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={changelogLoading || !version}
                  onClick={() => void generateChangelog()}
                >
                  {changelogLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{changelogLoading ? "Drafting posts…" : "Draft posts with AI"}</span>
                </button>
              </div>

              <div className="space-y-4">
                {!changelogDraft ? (
                  <Empty
                    title="No release drafts yet"
                    hint="Pick a changelog version and channel on the left, then click Draft posts with AI."
                  />
                ) : (
                  <>
                    {changelogDraft.linkedin !== undefined && (
                      <div className="card space-y-2.5 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-semibold">LinkedIn</h2>
                            <p className="mono text-[11px] text-soft">{changelogDraft.linkedin.length} chars</p>
                          </div>
                          <CopyButton text={changelogDraft.linkedin} />
                        </div>
                        <textarea
                          className="textarea"
                          rows={8}
                          value={changelogDraft.linkedin}
                          onChange={(e) =>
                            setChangelogDraft((d) => (d ? { ...d, linkedin: e.target.value } : d))
                          }
                        />
                      </div>
                    )}

                    {changelogDraft.x && changelogDraft.x.length > 0 && (
                      <div className="card space-y-3 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-semibold">X / Twitter</h2>
                            <p className="text-[11px] text-soft">{changelogDraft.x.length} post{changelogDraft.x.length === 1 ? "" : "s"}</p>
                          </div>
                          <CopyButton text={changelogDraft.x.join("\n\n---\n\n")} label="Copy all" />
                        </div>
                        <div className="space-y-2.5">
                          {changelogDraft.x.map((post, idx) => (
                            <div key={idx} className="rounded-md border border-line bg-muted/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className={cn("mono", post.length > 280 ? "text-rose-600 font-medium" : "text-soft")}>
                                  Post {idx + 1} · {post.length}/280
                                </span>
                                <CopyButton text={post} />
                              </div>
                              <textarea
                                className="textarea"
                                rows={3}
                                value={post}
                                onChange={(e) =>
                                  setChangelogDraft((d) => {
                                    if (!d?.x) return d;
                                    const next = [...d.x];
                                    next[idx] = e.target.value;
                                    return { ...d, x: next };
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {changelogDraft.facebook !== undefined && (
                      <div className="card space-y-2.5 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-semibold">Facebook</h2>
                            <p className="mono text-[11px] text-soft">{changelogDraft.facebook.length} chars</p>
                          </div>
                          <CopyButton text={changelogDraft.facebook} />
                        </div>
                        <textarea
                          className="textarea"
                          rows={6}
                          value={changelogDraft.facebook}
                          onChange={(e) =>
                            setChangelogDraft((d) => (d ? { ...d, facebook: e.target.value } : d))
                          }
                        />
                      </div>
                    )}

                    {changelogDraft.email && (
                      <div className="card space-y-3 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-sm font-semibold">Email newsletter</h2>
                          <CopyButton
                            label="Copy full email"
                            text={`Subject: ${changelogDraft.email.subject}\nPreview: ${changelogDraft.email.previewText}\n\n${changelogDraft.email.body}`}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Subject line">
                            <div className="flex gap-1.5">
                              <input
                                className="input"
                                value={changelogDraft.email.subject}
                                onChange={(e) =>
                                  setChangelogDraft((d) =>
                                    d?.email ? { ...d, email: { ...d.email, subject: e.target.value } } : d
                                  )
                                }
                              />
                              <CopyButton text={changelogDraft.email.subject} className="!h-8 shrink-0" />
                            </div>
                          </Field>
                          <Field label="Preview text">
                            <input
                              className="input"
                              value={changelogDraft.email.previewText}
                              onChange={(e) =>
                                setChangelogDraft((d) =>
                                  d?.email ? { ...d, email: { ...d.email, previewText: e.target.value } } : d
                                )
                              }
                            />
                          </Field>
                        </div>
                        <Field label="Body">
                          <textarea
                            className="textarea"
                            rows={10}
                            value={changelogDraft.email.body}
                            onChange={(e) =>
                              setChangelogDraft((d) =>
                                d?.email ? { ...d, email: { ...d.email, body: e.target.value } } : d
                              )
                            }
                          />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: INDUSTRY LANDING PAGE ==================== */}
          {tab === "landing" && (
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <div className="card h-fit space-y-4 p-4">
                <Field label="Target industry">
                  <input
                    className="input"
                    maxLength={120}
                    placeholder="e.g., Warehousing & logistics"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </Field>

                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setIndustry(preset)}
                      className="rounded-md border border-line bg-muted/60 px-2 py-1 text-[11px] text-soft transition-colors hover:border-accent/50 hover:text-ink"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <Field label="Typical team size (optional)">
                  <input
                    className="input"
                    maxLength={80}
                    placeholder="e.g., 25–150 shift workers across 2–5 locations"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                  />
                </Field>

                <Field label="Specific pain points to address (optional)">
                  <textarea
                    className="textarea"
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g., Expiring forklift licenses, inconsistent verbal warnings, paper opening checklists."
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                  />
                </Field>

                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={landingLoading || industry.trim().length < 2}
                  onClick={() => void generateLanding()}
                >
                  {landingLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{landingLoading ? "Drafting landing page…" : "Draft landing page"}</span>
                </button>
              </div>

              <div>
                {!landingDraft ? (
                  <Empty
                    title="No landing page draft yet"
                    hint="Enter a target industry (headline, 3 pain points, 4 workflows, 3 FAQs, and SEO metadata will be drafted in copyable Markdown)."
                  />
                ) : (
                  <div className="card space-y-5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLandingView("preview")}
                          className={cn("btn !h-7 !text-xs", landingView === "preview" && "!border-accent/50 !bg-accent/10 !text-accent")}
                        >
                          Structured preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setLandingView("markdown")}
                          className={cn("btn !h-7 !text-xs", landingView === "markdown" && "!border-accent/50 !bg-accent/10 !text-accent")}
                        >
                          Editable Markdown
                        </button>
                      </div>
                      <CopyButton text={landingDraft.markdown} label="Copy Markdown" />
                    </div>

                    {landingView === "markdown" ? (
                      <textarea
                        className="textarea mono text-xs leading-relaxed"
                        rows={26}
                        value={landingDraft.markdown}
                        onChange={(e) =>
                          setLandingDraft((d) => (d ? { ...d, markdown: e.target.value } : d))
                        }
                      />
                    ) : (
                      <div className="space-y-5 text-[13px]">
                        <div className="rounded-lg border border-line bg-muted/50 p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="mono text-[11px] uppercase text-soft">SEO Meta</span>
                            <CopyButton
                              text={`Title: ${landingDraft.metaTitle}\nDescription: ${landingDraft.metaDescription}`}
                              label="Copy meta"
                            />
                          </div>
                          <div className="font-medium text-ink">
                            {landingDraft.metaTitle}{" "}
                            <span className="mono text-[11px] font-normal text-soft">({landingDraft.metaTitle.length} chars)</span>
                          </div>
                          <p className="text-xs text-soft">
                            {landingDraft.metaDescription}{" "}
                            <span className="mono text-[11px]">({landingDraft.metaDescription.length} chars)</span>
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <div className="mono text-[11px] uppercase text-soft">Hero</div>
                          <h2 className="text-xl font-semibold">{landingDraft.headline}</h2>
                          <p className="leading-relaxed text-soft">{landingDraft.subheadline}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="mono text-[11px] uppercase text-soft">3 Pain points</div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {landingDraft.painPoints.map((p, i) => (
                              <div key={i} className="rounded-lg border border-line p-3">
                                <div className="font-medium text-ink">{p.title}</div>
                                <p className="mt-1 text-xs leading-relaxed text-soft">{p.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="mono text-[11px] uppercase text-soft">4 OnboardOps workflows</div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {landingDraft.workflows.map((w, i) => (
                              <div key={i} className="rounded-lg border border-line p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-ink">{w.title}</span>
                                  <span className="badge border-line bg-muted text-soft">{w.feature}</span>
                                </div>
                                <p className="mt-1.5 text-xs leading-relaxed text-soft">{w.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="mono text-[11px] uppercase text-soft">3 FAQs</div>
                          <div className="divide-y divide-line rounded-lg border border-line">
                            {landingDraft.faqs.map((f, i) => (
                              <div key={i} className="p-3">
                                <div className="font-medium text-ink">{f.question}</div>
                                <p className="mt-1 text-xs leading-relaxed text-soft">{f.answer}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: TESTIMONIAL -> CASE STUDY ==================== */}
          {tab === "case-study" && (
            testimonials.length === 0 ? (
              <Empty
                title="No testimonials available"
                hint="Add customer testimonials under Website & Growth → Testimonials first, then generate a mini case study draft here."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="card h-fit space-y-4 p-4">
                  <Field label="Customer testimonial">
                    <select
                      className="input"
                      value={testimonialId}
                      onChange={(e) => setTestimonialId(e.target.value)}
                    >
                      {testimonials.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.company ? ` (${t.company})` : ""}
                          {t.rating ? ` · ${t.rating}/5` : ""}
                          {!t.visible ? " [hidden]" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedTestimonial && (
                    <div className="rounded-md border border-line bg-muted/50 p-3 text-xs space-y-1.5">
                      <p className="italic leading-relaxed text-ink">&ldquo;{selectedTestimonial.quote}&rdquo;</p>
                      <div className="text-soft">
                        — {selectedTestimonial.name}
                        {selectedTestimonial.jobTitle ? `, ${selectedTestimonial.jobTitle}` : ""}
                        {selectedTestimonial.company ? ` · ${selectedTestimonial.company}` : ""}
                      </div>
                      <p className="pt-1 text-[11px] text-soft/80">
                        Draft stays faithful to this quote and will not invent fake metrics.
                      </p>
                    </div>
                  )}

                  <Field label="Verified extra context (optional)">
                    <textarea
                      className="textarea"
                      rows={4}
                      maxLength={1200}
                      placeholder="Only include verified facts you actually know (e.g., team size, industry, which OnboardOps modules they use)."
                      value={caseContext}
                      onChange={(e) => setCaseContext(e.target.value)}
                    />
                  </Field>

                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={caseLoading || !testimonialId}
                    onClick={() => void generateCaseStudy()}
                  >
                    {caseLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>{caseLoading ? "Drafting case study…" : "Draft mini case study"}</span>
                  </button>
                </div>

                <div>
                  {!caseDraft ? (
                    <Empty
                      title="No case study draft yet"
                      hint="Select a customer testimonial on the left to draft a structured mini case study without invented metrics."
                    />
                  ) : (
                    <div className="card space-y-5 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCaseView("preview")}
                            className={cn("btn !h-7 !text-xs", caseView === "preview" && "!border-accent/50 !bg-accent/10 !text-accent")}
                          >
                            Structured preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setCaseView("markdown")}
                            className={cn("btn !h-7 !text-xs", caseView === "markdown" && "!border-accent/50 !bg-accent/10 !text-accent")}
                          >
                            Editable Markdown
                          </button>
                        </div>
                        <CopyButton text={caseDraft.markdown} label="Copy Markdown" />
                      </div>

                      {caseView === "markdown" ? (
                        <textarea
                          className="textarea mono text-xs leading-relaxed"
                          rows={22}
                          value={caseDraft.markdown}
                          onChange={(e) =>
                            setCaseDraft((d) => (d ? { ...d, markdown: e.target.value } : d))
                          }
                        />
                      ) : (
                        <div className="space-y-4 text-[13px]">
                          <div>
                            <div className="mono text-[11px] uppercase text-soft">Title</div>
                            <h2 className="mt-0.5 text-lg font-semibold">{caseDraft.title}</h2>
                            <div className="text-xs text-soft">{caseDraft.attribution}</div>
                          </div>

                          <div className="rounded-lg border border-line p-3.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="mono text-[11px] uppercase text-soft">Challenge</span>
                              <CopyButton text={caseDraft.challenge} />
                            </div>
                            <p className="leading-relaxed text-ink">{caseDraft.challenge}</p>
                          </div>

                          <div className="rounded-lg border border-line p-3.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="mono text-[11px] uppercase text-soft">Solution</span>
                              <CopyButton text={caseDraft.solution} />
                            </div>
                            <p className="leading-relaxed text-ink">{caseDraft.solution}</p>
                          </div>

                          <div className="rounded-lg border border-line p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="mono text-[11px] uppercase text-soft">Outcomes</span>
                              <CopyButton text={caseDraft.outcomes.map((o) => `- ${o}`).join("\n")} />
                            </div>
                            <ul className="list-disc space-y-1 pl-5 leading-relaxed text-ink">
                              {caseDraft.outcomes.map((o, i) => (
                                <li key={i}>{o}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg border border-line bg-muted/50 p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="mono text-[11px] uppercase text-soft">Pull quote</span>
                              <CopyButton text={`"${caseDraft.pullQuote}" — ${caseDraft.attribution}`} />
                            </div>
                            <blockquote className="italic leading-relaxed text-ink">
                              &ldquo;{caseDraft.pullQuote}&rdquo;
                            </blockquote>
                            <div className="text-xs text-soft">— {caseDraft.attribution}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
