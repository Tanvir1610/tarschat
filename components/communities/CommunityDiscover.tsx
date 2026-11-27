"use client";

import { useEffect, useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Compass, Flame, KeyRound, Plus, Search, Sparkles, X } from "lucide-react";
import { CommunityCard } from "./CommunityCard";
import { EmptyState, Skeleton, Spinner } from "../ui";
import { CATEGORIES } from "@/lib/communities";
import { cn } from "@/lib/utils";

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface Props {
  onOpen: (slug: string) => void;
  onCreate: () => void;
  onJoinWithCode: () => void;
}

const CardSkeletons = ({ n = 3 }: { n?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading communities">
    {Array.from({ length: n }).map((_, i) => (
      <Skeleton key={i} className="h-52 rounded-2xl" />
    ))}
  </div>
);

export function CommunityDiscover({ onOpen, onCreate, onJoinWithCode }: Props) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const searching = term.length >= 2;
  const results = useQuery(api.communities.search, searching ? { query: term, category: category ?? undefined } : "skip");
  const featured = useQuery(api.communities.featured, !searching && !category ? {} : "skip");
  const trending = useQuery(api.communities.trending, !searching && !category ? {} : "skip");
  const all = usePaginatedQuery(
    api.communities.listPublic,
    searching ? "skip" : { category: category ?? undefined },
    { initialNumItems: 12 }
  );

  return (
    <div className="chat-wash h-full overflow-y-auto overscroll-contain scrollbar-thin">
      <div className="pt-safe mx-auto w-full max-w-5xl px-4 pb-10 sm:px-8">
        {/* Hero */}
        <div className="flex flex-wrap items-end justify-between gap-3 pt-6 sm:pt-10">
          <div className="min-w-0">
            <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
              <Compass className="h-3.5 w-3.5" /> Tars Communities
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Find your <span className="text-brand-gradient">people</span>
            </h1>
            <p className="mt-1 max-w-lg text-sm text-muted">Discover communities around the things you love — or start your own.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onJoinWithCode} className="btn-ghost border border-line"><KeyRound className="h-4 w-4" /> Invite code</button>
            <button onClick={onCreate} className="btn-primary"><Plus className="h-4 w-4" /> Create</button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search communities"
            aria-label="Search communities"
            className="field rounded-2xl py-3 pl-11 pr-10 text-[15px] [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button onClick={() => setText("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 scrollbar-hide sm:-mx-8 sm:px-8" role="toolbar" aria-label="Filter by category">
          <div className="flex w-max gap-2">
            {[{ id: null, label: "All" }, ...CATEGORIES].map((c) => (
              <button
                key={c.id ?? "all"}
                onClick={() => setCategory(c.id as CategoryId | null)}
                aria-pressed={category === c.id}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95",
                  category === c.id ? "bg-brand text-white shadow-glow" : "border border-line bg-elevated text-muted hover:text-fg"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search results */}
        {searching ? (
          <section className="mt-6" aria-live="polite">
            <h2 className="mb-3 text-sm font-semibold text-fg">Results for “{term}”</h2>
            {results === undefined ? (
              <CardSkeletons />
            ) : results.length === 0 ? (
              <EmptyState icon={<Search className="h-6 w-6" />} title="No communities found" description="Try a different word, or create the community yourself." action={<button onClick={onCreate} className="btn-primary">Create one</button>} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((c) => <CommunityCard key={c._id} community={c} onOpen={onOpen} />)}
              </div>
            )}
          </section>
        ) : (
          <>
            {!category && featured && featured.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Sparkles className="h-4 w-4 text-violet" /> Featured</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {featured.slice(0, 3).map((c) => <CommunityCard key={c._id} community={c} onOpen={onOpen} />)}
                </div>
              </section>
            )}

            {!category && trending && trending.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Flame className="h-4 w-4 text-warn" /> Trending this week</h2>
                <div className="grid gap-2.5 md:grid-cols-2">
                  {trending.map((c) => <CommunityCard key={c._id} community={c} onOpen={onOpen} variant="row" />)}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-fg">{category ? CATEGORIES.find((c) => c.id === category)?.label : "All communities"}</h2>
              {all.status === "LoadingFirstPage" ? (
                <CardSkeletons n={6} />
              ) : all.results.length === 0 ? (
                <EmptyState
                  icon={<Compass className="h-6 w-6" />}
                  title={category ? "Nothing here yet" : "No public communities yet"}
                  description="Be the first — start a community and invite people to join."
                  action={<button onClick={onCreate} className="btn-primary"><Plus className="h-4 w-4" /> Create a community</button>}
                />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {all.results.map((c) => <CommunityCard key={c._id} community={c} onOpen={onOpen} />)}
                  </div>
                  {all.status !== "Exhausted" && (
                    <div className="mt-6 flex justify-center">
                      <button onClick={() => all.loadMore(12)} disabled={all.status === "LoadingMore"} className="btn-ghost border border-line px-5">
                        {all.status === "LoadingMore" ? <Spinner /> : null} Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
