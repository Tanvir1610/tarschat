/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chatRequests from "../chatRequests.js";
import type * as communities from "../communities.js";
import type * as communityChannels from "../communityChannels.js";
import type * as communityInvites from "../communityInvites.js";
import type * as communityMembers from "../communityMembers.js";
import type * as communityMessages from "../communityMessages.js";
import type * as conversations from "../conversations.js";
import type * as emails from "../emails.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as lib_community from "../lib/community.js";
import type * as lib_constants from "../lib/constants.js";
import type * as messages from "../messages.js";
import type * as moderation from "../moderation.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chatRequests: typeof chatRequests;
  communities: typeof communities;
  communityChannels: typeof communityChannels;
  communityInvites: typeof communityInvites;
  communityMembers: typeof communityMembers;
  communityMessages: typeof communityMessages;
  conversations: typeof conversations;
  emails: typeof emails;
  favorites: typeof favorites;
  http: typeof http;
  "lib/community": typeof lib_community;
  "lib/constants": typeof lib_constants;
  messages: typeof messages;
  moderation: typeof moderation;
  typing: typeof typing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
