/**
 * Every dictionary for one language, in a single module.
 *
 * LanguageContext imports these barrels dynamically, so each language becomes
 * one lazily-loaded chunk instead of 17 requests — and none of them sit in the
 * entry bundle. Before this, all 51 JSON files across the three languages were
 * statically imported, putting ~424 KB of translations into the chunk that
 * every visitor downloads, including the public offer pages that use none of
 * them.
 *
 * Generated to mirror the files in this directory: add a .json here and add its
 * line below, keeping the three languages in step.
 */

import callCenter from "./call-center.json";
import chat from "./chat.json";
import dashboard from "./dashboard.json";
import forgotPassword from "./forgot-password.json";
import home from "./home.json";
import inventory from "./inventory.json";
import invoices from "./invoices.json";
import leads from "./leads.json";
import links from "./links.json";
import login from "./login.json";
import marketplace from "./marketplace.json";
import notifications from "./notifications.json";
import pendingVerification from "./pending-verification.json";
import register from "./register.json";
import support from "./support.json";
import verification from "./verification.json";
import wallet from "./wallet.json";

export default {
  "call-center": callCenter,
  chat,
  dashboard,
  "forgot-password": forgotPassword,
  home,
  inventory,
  invoices,
  leads,
  links,
  login,
  marketplace,
  notifications,
  "pending-verification": pendingVerification,
  register,
  support,
  verification,
  wallet,
} as Record<string, any>;
