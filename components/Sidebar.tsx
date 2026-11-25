"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Bell,
  Inbox,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  Star,
  UserSearch,
  Users,
  X,
} from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { UserListItem } from "./UserListItem";
import { GroupChatModal } from "./GroupChatModal";
import { PendingRequests } from "./PendingRequests";
import { ProfileModal } from "./ProfileModal";
import { SettingsMenu } from "./SettingsMenu";
import { Avatar } from "./Avatar";
import { EmptyState, Skeleton, errorMessage, useToast } from "./ui";
import { useNotificationPrefs } from "@/hooks/useDesktopNotifications";
import { cn } from "@/lib/utils";
import { getConversationTitle } from "@/lib/conversation";

type View = "inbox" | "unread" | "groups" | "favorites" | "people";

interface SidebarProps {
  currentUser: Doc<"users">;
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
  notifications: ReturnType<typeof useNotificationPrefs>;
}

export function Sidebar({ currentUser, selectedConversationId, onSelectConversation, notifications }: SidebarProps) {
  const [view, setView] = useState<View>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const toast = useToast();

  const conversations = useQuery(api.conversations.getUserConversations, { userId: currentUser._id });
  const unreadCounts = useQuery(api.messages.getUnreadCounts, { userId: currentUser._id });
  const favoriteIds = useQuery(api.favorites.listFavorites, { userId: currentUser._id });
  const pendingRequests = useQuery(api.chatRequests.getPendingRequests, { userId: currentUser._id });
  const users = useQuery(api.users.searchUsers, { query: searchQuery, currentClerkId: currentUser.clerkId });
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  const unreadMap = useMemo(
    () => new Map((unreadCounts ?? []).map((u) => [u.conversationId as string, u.count])),
    [unreadCounts]
  );
  const favoriteSet = useMemo(() => new Set((favoriteIds ?? []) as string[]), [favoriteIds]);
  const totalUnread = useMemo(
    () => Array.from(unreadMap.values()).filter((n) => n > 0).length,
    [unreadMap]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (conversations ?? []).filter((c) => {
      if (view === "unread" && !(unreadMap.get(c._id) ?? 0)) return false;
      if (view === "groups" && c.type !== "group") return false;
      if (view === "favorites" && !favoriteSet.has(c._id)) return false;
      if (!q) return true;
      return getConversationTitle(c, currentUser._id).toLowerCase().includes(q);
    });
  }, [conversations, view, searchQuery, unreadMap, favoriteSet, currentUser._id]);

  const handleToggleFavorite = async (id: Id<"conversations">) => {
    try {
      await toggleFavorite({ userId: currentUser._id, conversationId: id });
    } catch (e) {
      toast(errorMessage(e, "Couldn't update favorites."), "error");
    }
  };

  const openConversation = (id: Id<"conversations">) => {
    setView("inbox");
    setSearchQuery("");
    setShowRequests(false);
    onSelectConversation(id);
  };

  const NAV: { id: View; label: string; icon: typeof Inbox; badge?: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "unread", label: "Unread", icon: MessageSquare, badge: totalUnread },
    { id: "groups", label: "Groups", icon: Users },
    { id: "favorites", label: "Favorites", icon: Star },
    { id: "people", label: "People", icon: UserSearch },
  ];

  const pendingCount = pendingRequests?.length ?? 0;

  const emptyCopy: Record<Exclude<View, "people">, { title: string; description: string; icon: React.ReactNode }> = {
    inbox: {
      title: searchQuery ? "No conversations found" : "Your inbox is empty",
      description: searchQuery ? "Try a different name." : "Find people in the People tab and send a chat request to get started.",
      icon: <MessagesSquare className="h-6 w-6" />,
    },
    unread: { title: "You're all caught up", description: "Nothing unread right now.", icon: <MessageSquare className="h-6 w-6" /> },
    groups: { title: "No groups yet", description: "Create a group with the + button above.", icon: <Users className="h-6 w-6" /> },
    favorites: { title: "No favorites yet", description: "Tap the star on a conversation to pin it here.", icon: <Star className="h-6 w-6" /> },
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Brand + actions */}
      <div className="pt-safe px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand flex h-9 w-9 items-center justify-center rounded-xl shadow-glow" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12Z" />
                <path d="M9 10h6M12 10v5" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-fg">
              Tars<span className="text-brand-gradient">Chat</span>
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowRequests((s) => !s)}
              className={cn("icon-btn relative", showRequests && "bg-subtle text-fg")}
              aria-label={pendingCount ? `${pendingCount} pending chat requests` : "Chat requests"}
              aria-expanded={showRequests}
            >
              <Bell className="h-[18px] w-[18px]" />
              {pendingCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                  {pendingCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowGroupModal(true)} className="icon-btn" aria-label="New group chat" title="New group">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder={view === "people" ? "Search people" : "Search conversations"}
            aria-label={view === "people" ? "Search people" : "Search conversations"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field rounded-2xl pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Views */}
        <nav aria-label="Conversation filters" className="mt-3 flex flex-wrap gap-1.5">
          {NAV.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95",
                view === id ? "bg-brand text-white shadow-glow" : "bg-subtle text-muted hover:text-fg"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {!!badge && badge > 0 && (
                <span
                  className={cn(
                    "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    view === id ? "bg-white/25 text-white" : "bg-accent text-bg"
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {showRequests && pendingRequests && pendingRequests.length > 0 && (
        <PendingRequests requests={pendingRequests} currentUser={currentUser} onConversationCreated={openConversation} />
      )}
      {showRequests && pendingRequests && pendingRequests.length === 0 && (
        <p className="mx-4 mb-2 animate-pop-in rounded-xl border border-line bg-subtle px-4 py-3 text-center text-sm text-muted">
          No pending chat requests.
        </p>
      )}

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 scrollbar-thin">
        {view !== "people" ? (
          <>
            {!conversations ? (
              <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading conversations">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState {...emptyCopy[view]} />
            ) : (
              <>
                <p className="px-5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {view === "inbox" ? "Recent conversations" : NAV.find((n) => n.id === view)?.label}
                </p>
                <ul>
                  {filteredConversations.map((convo) => (
                    <li key={convo._id}>
                      <ConversationItem
                        conversation={convo}
                        currentUser={currentUser}
                        isSelected={selectedConversationId === convo._id}
                        unreadCount={unreadMap.get(convo._id) ?? 0}
                        isFavorite={favoriteSet.has(convo._id)}
                        onToggleFavorite={() => handleToggleFavorite(convo._id)}
                        onClick={() => openConversation(convo._id)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : !users ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserSearch className="h-6 w-6" />}
            title={searchQuery ? "No people found" : "No one else is here yet"}
            description={searchQuery ? "Try a different name." : "Invite a friend to sign up — they'll show up here."}
          />
        ) : (
          <>
            <p className="px-5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              People on TarsChat
            </p>
            <ul>
              {users.map((user) => (
                <li key={user._id}>
                  <UserListItem user={user} currentUser={currentUser} onConversationCreated={openConversation} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Profile + settings */}
      <div className="relative border-t border-line p-3 pb-safe">
        {showSettings && (
          <SettingsMenu
            onClose={() => setShowSettings(false)}
            onEditProfile={() => setShowProfile(true)}
            notifications={notifications}
          />
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowProfile(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-subtle"
            aria-label="Open your profile"
          >
            <Avatar user={currentUser} size="md" showOnlineStatus />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-fg">{currentUser.name}</p>
              <p className="truncate text-xs text-muted">
                <span className="font-medium text-success">Online</span>
                {currentUser.bio ? ` · ${currentUser.bio}` : ""}
              </p>
            </div>
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={cn("icon-btn h-10 w-10", showSettings && "bg-subtle text-fg")}
            aria-label="Settings"
            aria-haspopup="menu"
            aria-expanded={showSettings}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showGroupModal && (
        <GroupChatModal
          currentUser={currentUser}
          onClose={() => setShowGroupModal(false)}
          onCreated={(id) => {
            setShowGroupModal(false);
            openConversation(id);
          }}
        />
      )}
      {showProfile && <ProfileModal user={currentUser} currentUser={currentUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
