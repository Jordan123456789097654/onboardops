"use client";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { submitFeedbackAction } from "@/actions/support";
import { Field, Modal, useAction } from "./ui";

export function FeedbackButton() {
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("Feedback");
  const [message, setMessage] = useState("");
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} aria-label="Send feedback" title="Send feedback"><MessageSquarePlus className="h-4 w-4" /><span className="hidden xl:inline">Feedback</span></button>
      <Modal open={open} onClose={() => setOpen(false)} title="Send feedback">
        <div className="space-y-3">
          <p className="text-xs text-soft">You are in the beta. Tell us what works, what is confusing, or what is broken. The team sees which workspace it came from.</p>
          <Field label="Type"><select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}><option>Feedback</option><option>Bug</option><option>Question</option></select></Field>
          <Field label="Message"><textarea className="textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What were you doing, and what happened? Please do not include passwords." /></Field>
          <button className="btn-primary w-full" disabled={pending || message.trim().length < 10} onClick={() => exec(() => submitFeedbackAction({ topic, message }), { success: "Thanks. We read every message.", onOk: () => { setOpen(false); setMessage(""); } })}>{pending ? "Sending…" : "Send"}</button>
        </div>
      </Modal>
    </>
  );
}
