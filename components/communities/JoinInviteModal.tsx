"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KeyRound, Lock, Users } from "lucide-react";
import { Modal, Spinner, errorMessage, useToast } from "../ui";
import { CommunityIcon } from "./CommunityIcon";
import { categoryLabel, extractInviteCode } from "@/lib/communities";

/** Join via invite link / code (also opened automatically from /?invite=CODE) */
export function JoinInviteModal({
  initialCode = "",
  onClose,
  onJoined,
}: {
  initialCode?: string;
  onClose: () => void;
  onJoined: (slug: string, code: string) => void;
}) {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(extractInviteCode(initialCode));
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const joinWithCode = useMutation(api.communityInvites.joinWithCode);

  useEffect(() => {
    const t = setTimeout(() => setCode(extractInviteCode(input)), 300);
    return () => clearTimeout(t);
  }, [input]);

  const preview = useQuery(api.communityInvites.previewCode, code.length >= 8 ? { code } : "skip");
  const checking = code.length >= 8 && preview === undefined;

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const { slug } = await joinWithCode({ code });
      toast("Welcome in!");
      onJoined(slug, code);
    } catch (e) {
      setError(errorMessage(e, "Couldn't use that invite."));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Modal
      title="Join with an invite"
      icon={<KeyRound className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <button onClick={handleJoin} disabled={!preview || joining} className="btn-primary w-full py-3">
          {joining && <Spinner />}
          {preview ? (preview.isMember ? "Open community" : `Join ${preview.name}`) : "Join community"}
        </button>
      }
    >
      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="invite-code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Invite link or code</label>
          <input id="invite-code" data-autofocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste an invite link or code" className="field font-mono" autoComplete="off" spellCheck={false} />
        </div>

        {checking && <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Checking invite…</div>}
        {!checking && code.length >= 8 && preview === null && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            This invite isn&apos;t valid. It may have expired, been revoked, or already been used up.
          </p>
        )}
        {preview && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-subtle p-3">
            <CommunityIcon name={preview.name} url={preview.iconUrl} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-semibold text-fg">
                {preview.name}
                {preview.visibility === "private" && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />}
              </p>
              <p className="line-clamp-2 text-xs text-muted">{preview.description}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <Users className="h-3 w-3" /> {preview.memberCount} · {categoryLabel(preview.category)}
              </p>
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
