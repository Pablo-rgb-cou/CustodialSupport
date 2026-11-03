// Plain-text composition only. HTML is generated and escaped on the server.
export const customerEmailUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const customerEmailAddress = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export type CustomerEmailDraft = { recipientName: string; recipientEmail: string; clientId: string | null; subject: string; message: string };

export function parseCustomerEmailDraft(value: Record<string, unknown>): CustomerEmailDraft {
  const text = (key: string, max: number, required = true, multiline = false) => {
    if (typeof value[key] !== "string") throw new Error("Check the email fields.");
    const result = (value[key] as string).trim();
    if ((required && !result) || result.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(result)) throw new Error("Check the email fields and length limits.");
    return result;
  };
  const recipientEmail = text("recipientEmail", 254).toLowerCase();
  const localPart = recipientEmail.split("@")[0];
  if (!customerEmailAddress.test(recipientEmail) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) throw new Error("Enter one valid recipient email address.");
  const clientId = value.clientId == null || value.clientId === "" ? null : value.clientId;
  if (clientId !== null && (typeof clientId !== "string" || !customerEmailUuid.test(clientId))) throw new Error("Choose a valid client.");
  return { recipientName: text("recipientName", 100, false), recipientEmail, clientId, subject: text("subject", 160), message: text("message", 12000, true, true) };
}
