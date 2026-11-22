"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";
import { retryEmailAction, sendTestEmailAction } from "@/actions/admin";
import { Field, Modal, useAction } from "@/components/ui";

export function SendTestEmailButton({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultEmail);
  const [subject, setSubject] = useState("OnboardOps delivery test");
  const [message, setMessage] = useState("This is a test message confirming outgoing delivery from notifications@onboardops.org via Resend.");

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" />
        Send Test Email
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Send test email">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">Sends a live email via Resend from <span className="mono">OnboardOps &lt;notifications@onboardops.org&gt;</span>.</p>
          <Field label="Recipient email">
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Subject">
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Body">
            <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={pending || !to.trim()}
            onClick={() =>
              exec(() => sendTestEmailAction({ to, subject, message }), {
                success: `Test email sent to ${to}`,
                onOk: () => {
                  setOpen(false);
                  router.refresh();
                },
              })
            }
          >
            {pending ? "Sending…" : "Send test email"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function RetryEmailButton({ id }: { id: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <button
      className="btn !h-7 !px-2 !text-xs"
      disabled={pending}
      onClick={() =>
        exec(() => retryEmailAction(id), {
          success: "Email re-sent successfully",
          onOk: () => router.refresh(),
        })
      }
    >
      <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
      Retry
    </button>
  );
}
