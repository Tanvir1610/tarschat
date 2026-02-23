import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Send email notification for new message when user is offline
export const sendMessageNotificationEmail = internalAction({
  args: {
    toEmail: v.string(),
    toName: v.string(),
    fromName: v.string(),
    messagePreview: v.string(),
    conversationId: v.string(),
  },
  handler: async (ctx, { toEmail, toName, fromName, messagePreview, conversationId }) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return; // Silently skip if not configured

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tarschat.vercel.app";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>New Message from ${fromName}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">💬 TarsChat</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">You have a new message</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Hi <strong style="color:#1e293b;">${toName}</strong>,</p>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                <strong style="color:#1e293b;">${fromName}</strong> sent you a message while you were away:
              </p>
              <!-- Message Preview -->
              <div style="background:#f1f5f9;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;font-style:italic;">"${messagePreview}"</p>
              </div>
              <!-- CTA Button -->
              <div style="text-align:center;">
                <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                  Open TarsChat →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                You're receiving this because you have an account on TarsChat.<br>
                This notification was sent because you were offline.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TarsChat <notifications@tarschat.app>",
          to: toEmail,
          subject: `💬 New message from ${fromName}`,
          html,
        }),
      });
    } catch (err) {
      console.error("Failed to send email:", err);
    }
  },
});

// Send chat request notification email
export const sendChatRequestEmail = internalAction({
  args: {
    toEmail: v.string(),
    toName: v.string(),
    fromName: v.string(),
  },
  handler: async (ctx, { toEmail, toName, fromName }) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tarschat.vercel.app";

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">💬 TarsChat</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">New Chat Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#64748b;font-size:15px;">Hi <strong style="color:#1e293b;">${toName}</strong>,</p>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                <strong style="color:#1e293b;">${fromName}</strong> wants to chat with you on TarsChat!
                You have <strong style="color:#ef4444;">24 hours</strong> to accept or decline.
              </p>
              <div style="text-align:center;">
                <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
                  View Request →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Request expires in 24 hours.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TarsChat <notifications@tarschat.app>",
          to: toEmail,
          subject: `👋 ${fromName} wants to chat with you!`,
          html,
        }),
      });
    } catch (err) {
      console.error("Failed to send email:", err);
    }
  },
});
