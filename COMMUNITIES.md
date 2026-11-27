# Tars Communities

Discover, join and create communities inside TarsChat. Open the **Communities** tab (top of the sidebar).

## One-time setup (required — this is what makes the server know who is calling)

Communities never trust a user id sent by the browser. Every Convex function reads the identity from the
verified Clerk token, so Clerk must be connected to Convex:

1. **Clerk Dashboard → JWT Templates → New template → "Convex"** (the template name must be exactly `convex`). Save.
2. Copy the template's **Issuer** URL (looks like `https://your-app-12.clerk.accounts.dev`).
3. Set it on your Convex deployment:
   ```
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app-12.clerk.accounts.dev
   ```
   (or Convex Dashboard → Settings → Environment Variables)
4. Deploy the backend: `npx convex dev` (or `npx convex deploy` for production — set the variable on production too).

Until step 3 is done, chats and groups work exactly as before, and the Communities tab shows a
"Finish the Communities setup" notice.

## Features

| Area | What you get |
|---|---|
| Discovery | Public communities only. Search by name, description or category; category filter chips; **Featured** (largest public communities); **Trending** (most new members + messages in the last 7 days); paginated "All communities". |
| Creation | Name, unique `@username` (live availability check), description, category, icon upload (PNG/JPG/WEBP/GIF ≤ 2 MB, verified server-side), public or private. Creates `#general`, `#announcements` (moderators-only posting) and `#discussion`. |
| Community page | Channel tabs, real-time messaging, paginated history ("Load older messages"), member panel (staff + paginated members), settings. |
| Membership | Join/leave public communities. Private communities are invisible (indistinguishable from non-existent) without an invitation: shareable invite links (expiry + max uses, revocable) and direct invitations delivered to the invitee's inbox. |
| Roles | **Owner** · **Moderator** · **Member**. |
| Administration | Owner: edit community, manage channels, promote/demote moderators, remove/ban/unban members, transfer ownership, delete community. Moderators: remove inappropriate messages, handle the report queue, create invites. |
| Safety | Report a message or member; moderation queue (open/resolved/dismissed); **block** a person (their community messages are hidden from you — the text is never sent to your browser). Flood control (5 messages / 10 s). |

## Permission matrix (enforced in Convex, not just hidden in the UI)

| Action | Non-member | Member | Moderator | Owner |
|---|:-:|:-:|:-:|:-:|
| See public community page + channel names | ✅ | ✅ | ✅ | ✅ |
| See a private community | ❌ (needs invite) | ✅ | ✅ | ✅ |
| Read messages / member list | ❌ | ✅ | ✅ | ✅ |
| Post in #general / #discussion | ❌ | ✅ | ✅ | ✅ |
| Post in #announcements | ❌ | ❌ | ✅ | ✅ |
| Delete own message | – | ✅ | ✅ | ✅ |
| Remove others' messages | ❌ | ❌ | members' only | anyone's |
| Report / block | ❌ | ✅ | ✅ | ✅ |
| View reports, resolve | ❌ | ❌ | ✅ | ✅ |
| Create invite links / invite people | ❌ | ❌ | ✅ | ✅ |
| Edit community, channels, roles | ❌ | ❌ | ❌ | ✅ |
| Remove / ban / unban members | ❌ | ❌ | ❌ | ✅ |
| Transfer ownership / delete community | ❌ | ❌ | ❌ | ✅ |

## Limits

Name 3–50 · username 3–32 (`a-z 0-9 -`, reserved words blocked) · description 10–500 · message ≤ 2000 ·
5 owned communities per person · 100 joined · 10 channels · 20 moderators · page size capped at 50 server-side.

## Notes

* Emails are never returned by any community function.
* Member counts are stored on the community and updated in the same transaction as each join/leave/removal/ban.
* Deleting a community hides it immediately and purges channels, messages, members, invites, bans and reports in batches.
* User blocks only affect community message visibility. Direct messages and group chats are unchanged.
* The existing chat functions (DMs, groups, requests) still identify callers by a client-supplied `userId`; only Communities are
  hardened with token-based identity. Migrating the rest the same way is recommended.
