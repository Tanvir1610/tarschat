// Verifies the Clerk JWT that the browser sends to Convex. Communities use this to know
// WHO is calling (the server never trusts a user id sent by the browser).
//
// One-time setup:
//   1. Clerk Dashboard → JWT Templates → New template → choose "Convex"  (name must be exactly `convex`)
//   2. Copy its "Issuer" URL, e.g. https://your-app-12.clerk.accounts.dev
//   3. Run:  npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app-12.clerk.accounts.dev
//      (or add it under Convex Dashboard → Settings → Environment Variables)
//
// Until that variable exists, everything else (chats, groups) keeps working and the
// Communities tab shows a setup notice — the deploy never breaks.
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;

export default {
  providers: domain ? [{ domain, applicationID: "convex" }] : [],
};
