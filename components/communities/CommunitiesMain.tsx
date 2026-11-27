"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ArrowLeft, SearchX } from "lucide-react";
import { CommunityDiscover } from "./CommunityDiscover";
import { CommunityLanding } from "./CommunityLanding";
import { CommunityWorkspace } from "./CommunityWorkspace";
import { AccessBoundary } from "./AccessBoundary";
import { EmptyState, Skeleton } from "../ui";

export type CommunityRoute =
  | { kind: "discover" }
  | { kind: "community"; slug: string; channelSlug?: string; inviteCode?: string };

interface Props {
  route: CommunityRoute;
  me: Doc<"users">;
  onNavigate: (r: CommunityRoute) => void;
  onBack: () => void;
  onCreate: () => void;
  onJoinWithCode: () => void;
}

export function CommunitiesMain({ route, me, onNavigate, onBack, onCreate, onJoinWithCode }: Props) {
  if (route.kind === "discover") {
    return (
      <div className="relative h-full">
        <div className="pt-safe absolute left-0 top-0 z-10 md:hidden">
          <button onClick={onBack} className="icon-btn m-2 bg-surface/80 backdrop-blur" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        </div>
        <CommunityDiscover onOpen={(slug) => onNavigate({ kind: "community", slug })} onCreate={onCreate} onJoinWithCode={onJoinWithCode} />
      </div>
    );
  }
  return (
    <AccessBoundary key={route.slug} onExit={() => onNavigate({ kind: "discover" })}>
      <CommunityPage route={route} me={me} onNavigate={onNavigate} onBack={onBack} />
    </AccessBoundary>
  );
}

function CommunityPage({ route, me, onNavigate, onBack }: { route: Extract<CommunityRoute, { kind: "community" }>; me: Doc<"users">; onNavigate: (r: CommunityRoute) => void; onBack: () => void }) {
  const preview = useQuery(api.communities.getPreview, { slug: route.slug, inviteCode: route.inviteCode });

  if (preview === undefined) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading community">
        <Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (preview.status === "unavailable" || preview.status === "banned") {
    return (
      <EmptyState
        className="h-full"
        icon={<SearchX className="h-6 w-6" />}
        title={preview.status === "banned" ? "You can't join this community" : "Community not found"}
        description={preview.status === "banned" ? `You have been banned from ${preview.name}.` : "It may have been deleted, or it's private and needs an invitation."}
        action={<button onClick={() => onNavigate({ kind: "discover" })} className="btn-primary">Discover communities</button>}
      />
    );
  }
  if (!preview.myRole) {
    return <CommunityLanding preview={preview} inviteCode={route.inviteCode} onBack={onBack} />;
  }
  return (
    <CommunityWorkspace
      preview={preview}
      role={preview.myRole}
      me={me}
      channelSlug={route.channelSlug}
      onChannel={(channelSlug) => onNavigate({ ...route, channelSlug })}
      onBack={onBack}
      onLeft={() => onNavigate({ kind: "discover" })}
    />
  );
}
