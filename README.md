# 🤖 TarsChat — Real-time Messaging App

A full-featured real-time chat app built with **Next.js 15**, **TypeScript**, **Convex**, and **Clerk**.

## ✅ Features Implemented

- **Authentication** — Clerk sign up/login (email + social), user avatars
- **User List & Search** — See all users, search by name in real time
- **One-on-One Direct Messages** — Private conversations with real-time Convex subscriptions
- **Message Timestamps** — Smart formatting (time only today, date+time older, year if different year)
- **Empty States** — Helpful messages for no conversations, no messages, no search results
- **Responsive Layout** — Desktop sidebar + chat, Mobile full-screen chat with back button
- **Online/Offline Status** — Green dot indicator, updates in real time
- **Typing Indicator** — "Alex is typing..." with animated dots, disappears after 2s
- **Unread Message Count** — Badges on sidebar, cleared on open, real-time
- **Smart Auto-Scroll** — Auto-scrolls to new messages; shows "↓ New messages" if scrolled up
- **Delete Own Messages** — Soft delete with "This message was deleted" shown in italics
- **Message Reactions** — 👍 ❤️ 😂 😮 😢 with counts, toggle on/off
- **Loading & Error States** — Skeleton loaders, send error with retry button
- **Group Chat** — Create group with name + multiple members, real-time

---

## 🚀 Setup Guide (Step by Step)

### Prerequisites
- Node.js 18+ installed
- npm or yarn
- Free accounts on: [Clerk](https://clerk.com), [Convex](https://convex.dev), [Vercel](https://vercel.com)

---

### Step 1: Clone & Install

```bash
git clone <your-repo-url>
cd tars-chat
npm install
```

---

### Step 2: Set Up Clerk

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application
3. Enable **Email/Password** and any social providers you want (Google recommended)
4. Go to **API Keys** → copy your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

---

### Step 3: Set Up Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in / create a Convex account
- Create a new Convex project
- Give you your `NEXT_PUBLIC_CONVEX_URL`
- Start syncing your `convex/` folder automatically

Keep this terminal running during development!

---

### Step 4: Set Up Clerk Webhook (to sync users to Convex)

1. In Clerk dashboard → **Webhooks** → **Add Endpoint**
2. Endpoint URL: `https://YOUR_CONVEX_URL/clerk-webhook`
   - Find your Convex URL from [https://dashboard.convex.dev](https://dashboard.convex.dev) → your project → Settings
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** and save it — you'll add it as `CLERK_WEBHOOK_SECRET`

Also install the svix package for webhook verification:
```bash
npm install svix
```

---

### Step 5: Create `.env.local`

```bash
cp .env.local.example .env.local
```

Fill in:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
NEXT_PUBLIC_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
CLERK_WEBHOOK_SECRET=whsec_...
```

---

### Step 6: Run Locally

In two terminals:

**Terminal 1 — Convex backend:**
```bash
npx convex dev
```

**Terminal 2 — Next.js frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Step 7: Deploy to Vercel

1. Push code to GitHub
2. Go to [https://vercel.com](https://vercel.com) → Import your repo
3. Add all environment variables from `.env.local`
4. Also add `CONVEX_DEPLOY_KEY` — get it from Convex dashboard → Settings → Deploy Keys
5. Deploy!

**Also set your production Convex deployment:**
```bash
npx convex deploy
```

---

## 📁 Project Structure

```
tars-chat/
├── app/
│   ├── layout.tsx          # Root layout with Clerk + Convex providers
│   ├── page.tsx            # Home page — initializes user, renders ChatLayout
│   ├── sign-in/            # Clerk sign-in page
│   ├── sign-up/            # Clerk sign-up page
│   └── globals.css         # Tailwind base styles
├── components/
│   ├── ChatLayout.tsx      # Main layout — sidebar + chat area
│   ├── Sidebar.tsx         # Conversation list, user search, tabs
│   ├── ChatArea.tsx        # Message list, auto-scroll, header
│   ├── MessageBubble.tsx   # Individual message with reactions/delete
│   ├── MessageInput.tsx    # Text input with typing indicator
│   ├── TypingIndicator.tsx # Animated dots + "X is typing"
│   ├── ConversationItem.tsx # Sidebar conversation row with unread badge
│   ├── UserListItem.tsx    # User row in Users tab
│   ├── GroupChatModal.tsx  # Modal to create group chats
│   └── Avatar.tsx          # User avatar with online status dot
├── convex/
│   ├── schema.ts           # Database schema (users, conversations, messages, etc.)
│   ├── users.ts            # User queries/mutations
│   ├── conversations.ts    # Conversation queries/mutations
│   ├── messages.ts         # Message queries/mutations (send, delete, react, unread)
│   ├── typing.ts           # Typing indicator mutations/queries
│   └── http.ts             # Clerk webhook handler
├── hooks/
│   └── useOnlineStatus.ts  # Hook to track online/offline
├── lib/
│   └── utils.ts            # cn() helper, timestamp formatters
└── middleware.ts            # Clerk auth middleware
```

## 🗄️ Database Schema (Convex)

- **users** — Synced from Clerk (clerkId, name, email, imageUrl, isOnline, lastSeen)
- **conversations** — DMs or groups (type, name, memberIds, lastMessageId, lastMessageTime)
- **messages** — Chat messages (conversationId, senderId, content, isDeleted, reactions)
- **readReceipts** — Per-user per-conversation read tracking (lastReadTime)
- **typingIndicators** — Who is currently typing where (userId, conversationId, updatedAt)

## 🛠️ Tech Stack

- **Next.js 15** (App Router) — Frontend framework
- **TypeScript** — Type safety throughout
- **Convex** — Real-time backend, database, subscriptions
- **Clerk** — Authentication (email + social login)
- **Tailwind CSS** — Styling
- **Lucide React** — Icons
