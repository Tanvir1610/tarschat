"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Modal, Spinner, errorMessage, useToast } from "../ui";
import { LIMITS, REPORT_REASONS } from "@/lib/communities";
import { cn } from "@/lib/utils";

type Reason = (typeof REPORT_REASONS)[number]["id"];

export function ReportModal({
  title,
  subject,
  onSubmit,
  onClose,
}: {
  title: string;
  subject?: string;
  onSubmit: (reason: Reason, details: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason, details.trim());
      toast("Report sent to the moderators");
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't send the report."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      icon={<Flag className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">
          {busy && <Spinner />} Send report
        </button>
      }
    >
      <div className="space-y-4 p-5">
        {subject && <p className="line-clamp-3 rounded-xl border-l-[3px] border-accent bg-subtle px-3 py-2 text-sm text-muted">{subject}</p>}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Reason</legend>
          <div className="space-y-1.5" role="radiogroup">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                className={cn("flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition", reason === r.id ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg")}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", reason === r.id ? "border-accent" : "border-line")}>
                  {reason === r.id && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="report-details" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Details (optional)</label>
          <textarea id="report-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value.slice(0, LIMITS.reportDetailsMax))} className="field resize-none" placeholder="Anything the moderators should know?" />
        </div>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
