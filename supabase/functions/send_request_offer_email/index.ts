import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  request_offer_id: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEmailHtml(
  requestOffer: any,
  project: any,
  company: any,
  lineItems: any[],
  attachmentLinks: { name: string; url: string }[],
  supplierName: string
): string {
  const typeLabel = requestOffer.type === "material" ? "Material" : "Service";
  const isUrgent = requestOffer.priority === "urgent";
  const projectDisplay = project
    ? `${escapeHtml(project.project_code)} - ${escapeHtml(project.project_name)}`
    : escapeHtml(requestOffer.project_name) || "-";

  const urgentBanner = isUrgent
    ? `<div style="background-color:#fee2e2;border-left:4px solid #dc2626;color:#991b1b;padding:12px 15px;margin:15px 0;border-radius:4px;font-weight:bold;">⚠️ URGENT REQUEST - Priority response required</div>`
    : "";

  const vesselRow = requestOffer.vessel_or_job
    ? `<div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Vessel/Job:</span><span>${escapeHtml(requestOffer.vessel_or_job)}</span></div>`
    : "";

  const specialInstructions = requestOffer.special_instructions
    ? `<div style="margin:8px 0;"><span style="font-weight:bold;">Special Instructions:</span><div style="margin-top:5px;white-space:pre-wrap;background:#fffbeb;padding:10px;border-radius:4px;">${escapeHtml(requestOffer.special_instructions)}</div></div>`
    : "";

  // Line items table
  let itemsHtml = "";
  if (lineItems && lineItems.length > 0) {
    const rows = lineItems
      .map(
        (item) =>
          `<tr><td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${item.item_number}</td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(item.description)}</td><td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${item.qty ?? "-"}</td><td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.uom) || "-"}</td></tr>`
      )
      .join("");
    itemsHtml = `
      <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
        <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Items Requested</div>
        <table style="width:100%;border-collapse:collapse;margin:10px 0;">
          <thead><tr>
            <th style="background-color:#f3f4f6;padding:10px;text-align:center;border:1px solid #e5e7eb;width:50px;">#</th>
            <th style="background-color:#f3f4f6;padding:10px;text-align:left;border:1px solid #e5e7eb;">Description</th>
            <th style="background-color:#f3f4f6;padding:10px;text-align:center;border:1px solid #e5e7eb;width:100px;">Quantity</th>
            <th style="background-color:#f3f4f6;padding:10px;text-align:center;border:1px solid #e5e7eb;width:80px;">Unit</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Attachments
  let attachmentsHtml = "";
  if (attachmentLinks.length > 0) {
    const links = attachmentLinks.map((a) => `<li style="margin:5px 0;"><a href="${a.url}" style="color:#f97316;">${escapeHtml(a.name)}</a></li>`).join("");
    attachmentsHtml = `
      <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
        <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Attachments</div>
        <ul style="margin:0;padding-left:20px;">${links}</ul>
      </div>`;
  }

  // Additional notes
  const notesHtml = requestOffer.message_to_recipients
    ? `<div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
        <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Additional Notes</div>
        <div style="white-space:pre-wrap;">${escapeHtml(requestOffer.message_to_recipients)}</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;">
  <div style="background-color:#f97316;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">Request for Offer: ${escapeHtml(requestOffer.ro_number)}</h2>
  </div>
  <div style="padding:20px;max-width:700px;margin:0 auto;">
    <p>Dear ${escapeHtml(supplierName)},</p>
    <p>We invite you to submit an offer for the following request:</p>

    ${urgentBanner}

    ${company ? `
    <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
      <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Requesting Company</div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Company:</span><span>${escapeHtml(company.company_name)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Company Code:</span><span>${escapeHtml(company.company_code)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">VAT Number:</span><span>${escapeHtml(company.vat_number)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Address:</span><span>${escapeHtml(company.address)}, ${escapeHtml(company.postal_code)} ${escapeHtml(company.city)}, ${escapeHtml(company.country)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Phone:</span><span>${escapeHtml(company.phone)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Email:</span><span>${escapeHtml(company.email)}</span></div>
    </div>` : ''}

    <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
      <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">General Information</div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Type:</span><span>${typeLabel}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Priority:</span><span>${isUrgent ? '<span style="color:#dc2626;font-weight:bold;">Urgent</span>' : "Normal"}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Project:</span><span>${projectDisplay}</span></div>
      ${vesselRow}
    </div>

    <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
      <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Request Details</div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Title:</span><span>${escapeHtml(requestOffer.title)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;">Description:</span><div style="margin-top:5px;white-space:pre-wrap;">${escapeHtml(requestOffer.description)}</div></div>
      ${specialInstructions}
    </div>

    ${itemsHtml}

    <div style="margin:20px 0;padding:15px;border-left:4px solid #f97316;background-color:#fff7ed;">
      <div style="font-weight:bold;font-size:16px;margin-bottom:10px;color:#f97316;text-transform:uppercase;">Delivery & Contact Information</div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Response Deadline:</span><span>${formatDate(requestOffer.response_deadline)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Needed By:</span><span>${formatDate(requestOffer.needed_by)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Delivery Location:</span><span>${escapeHtml(requestOffer.delivery_location)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Contact Person:</span><span>${escapeHtml(requestOffer.contact_person)}</span></div>
      <div style="margin:8px 0;"><span style="font-weight:bold;display:inline-block;min-width:160px;">Contact Phone:</span><span>${escapeHtml(requestOffer.contact_phone)}</span></div>
    </div>

    ${attachmentsHtml}
    ${notesHtml}

    <div style="margin-top:30px;padding-top:20px;border-top:2px solid #e5e7eb;color:#6b7280;">
      <p><strong>Please reply to this email with your offer.</strong></p>
      <p>Best regards,<br/>SKYNET Procurement Team</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const fromEmail = Deno.env.get("FROM_EMAIL") || "SKYNET Procurement <onboarding@resend.dev>";
    const replyToEmail = Deno.env.get("REPLY_TO_EMAIL");
    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { request_offer_id }: RequestBody = await req.json();
    if (!request_offer_id) throw new Error("request_offer_id is required");

    console.log(`Processing request offer: ${request_offer_id}`);

    // Fetch request offer
    const { data: requestOffer, error: roError } = await supabase
      .from("request_offers")
      .select("*")
      .eq("id", request_offer_id)
      .single();
    if (roError || !requestOffer) throw new Error(`Request offer not found: ${roError?.message}`);

    // Fetch project info
    let project = null;
    if (requestOffer.project_id) {
      const { data } = await supabase
        .from("projects")
        .select("project_code, project_name")
        .eq("id", requestOffer.project_id)
        .single();
      project = data;
    }

    // Fetch line items
    const { data: lineItems } = await supabase
      .from("request_offer_items")
      .select("item_number, description, qty, uom")
      .eq("request_offer_id", request_offer_id)
      .order("item_number");

    // Fetch recipients
    const { data: recipients, error: recsError } = await supabase
      .from("request_offer_recipients")
      .select(`*, supplier:suppliers(name, email)`)
      .eq("request_offer_id", request_offer_id);
    if (recsError) throw new Error(`Failed to fetch recipients: ${recsError.message}`);
    if (!recipients || recipients.length === 0) throw new Error("No recipients found");

    // Fetch attachments & generate signed URLs
    const { data: attachments } = await supabase
      .from("request_offer_attachments")
      .select("*")
      .eq("request_offer_id", request_offer_id);

    const attachmentLinks: { name: string; url: string }[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from("procurement")
          .createSignedUrl(att.file_path, 60 * 60 * 24 * 7);
        if (!urlError && signedUrl) {
          attachmentLinks.push({ name: att.filename, url: signedUrl.signedUrl });
        }
      }
    }

    const subject = `[SKYNET] Request Offer ${requestOffer.ro_number} - ${requestOffer.title}`;
    let sentCount = 0;
    let failedCount = 0;
    const failures: { email: string; error: string }[] = [];

    for (const recipient of recipients) {
      const email = recipient.email_used || recipient.supplier?.email;
      if (!email) {
        await supabase.from("request_offer_recipients").update({ status: "failed", error_message: "No email address" }).eq("id", recipient.id);
        failedCount++;
        failures.push({ email: "N/A", error: "No email address" });
        continue;
      }

      const supplierName = recipient.supplier?.name || "Valued Partner";
      const htmlBody = buildEmailHtml(requestOffer, project, lineItems || [], attachmentLinks, supplierName);

      try {
        console.log(`Sending email to: ${email}`);
        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [email],
          subject,
          html: htmlBody,
          ...(replyToEmail && { reply_to: replyToEmail }),
        });

        if (emailResponse.error) {
          const errorMsg = emailResponse.error.message || "Resend API error";
          console.error(`Resend error for ${email}:`, errorMsg);
          await supabase.from("request_offer_recipients").update({ status: "failed", error_message: errorMsg }).eq("id", recipient.id);
          failedCount++;
          failures.push({ email, error: errorMsg });
        } else {
          await supabase.from("request_offer_recipients").update({ status: "sent", sent_at: new Date().toISOString(), error_message: null }).eq("id", recipient.id);
          sentCount++;
        }
      } catch (emailError: any) {
        console.error(`Exception sending email to ${email}:`, emailError);
        await supabase.from("request_offer_recipients").update({ status: "failed", error_message: emailError.message || "Unknown error" }).eq("id", recipient.id);
        failedCount++;
        failures.push({ email, error: emailError.message || "Unknown error" });
      }
    }

    if (sentCount > 0) {
      await supabase.from("request_offers").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", request_offer_id);
    }

    console.log(`Completed: ${sentCount} sent, ${failedCount} failed`);
    return new Response(JSON.stringify({ success: true, sent_count: sentCount, failed_count: failedCount, failures }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send_request_offer_email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
