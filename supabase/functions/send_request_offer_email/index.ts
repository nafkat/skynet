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

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendApiKey);

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { request_offer_id }: RequestBody = await req.json();

    if (!request_offer_id) {
      throw new Error("request_offer_id is required");
    }

    console.log(`Processing request offer: ${request_offer_id}`);

    // Fetch request offer
    const { data: requestOffer, error: roError } = await supabase
      .from("request_offers")
      .select("*")
      .eq("id", request_offer_id)
      .single();

    if (roError || !requestOffer) {
      throw new Error(`Request offer not found: ${roError?.message}`);
    }

    // Fetch recipients with supplier info
    const { data: recipients, error: recsError } = await supabase
      .from("request_offer_recipients")
      .select(`
        *,
        supplier:suppliers(name, email)
      `)
      .eq("request_offer_id", request_offer_id);

    if (recsError) {
      throw new Error(`Failed to fetch recipients: ${recsError.message}`);
    }

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients found for this request offer");
    }

    // Fetch attachments
    const { data: attachments, error: attsError } = await supabase
      .from("request_offer_attachments")
      .select("*")
      .eq("request_offer_id", request_offer_id);

    if (attsError) {
      console.error("Error fetching attachments:", attsError);
    }

    // Generate signed URLs for attachments (7 days expiry)
    const attachmentLinks: { name: string; url: string }[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from("procurement")
          .createSignedUrl(att.file_path, 60 * 60 * 24 * 7);

        if (!urlError && signedUrl) {
          attachmentLinks.push({
            name: att.filename,
            url: signedUrl.signedUrl,
          });
        }
      }
    }

    // Build email content
    const typeLabel = requestOffer.type === "material" ? "Material" : "Service";
    const subject = `[SKYNET] Request Offer ${requestOffer.ro_number} - ${requestOffer.title}`;

    let sentCount = 0;
    let failedCount = 0;
    const failures: { email: string; error: string }[] = [];

    // Send email to each recipient
    for (const recipient of recipients) {
      const email = recipient.email_used || recipient.supplier?.email;

      if (!email) {
        console.log(`Skipping recipient ${recipient.id} - no email`);
        await supabase
          .from("request_offer_recipients")
          .update({
            status: "failed",
            error_message: "No email address",
          })
          .eq("id", recipient.id);
        failedCount++;
        failures.push({ email: "N/A", error: "No email address" });
        continue;
      }

      // Build HTML body
      let htmlBody = `
        <h2>Request for Offer: ${requestOffer.ro_number}</h2>
        <p>Dear ${recipient.supplier?.name || "Valued Partner"},</p>
        <p>We invite you to submit an offer for the following:</p>
        
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Type:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${typeLabel}</td>
          </tr>
          ${requestOffer.project_name ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Project:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${requestOffer.project_name}</td>
          </tr>
          ` : ""}
          ${requestOffer.vessel_or_job ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Vessel/Job:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${requestOffer.vessel_or_job}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Title:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${requestOffer.title}</td>
          </tr>
          ${requestOffer.qty ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Quantity:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${requestOffer.qty} ${requestOffer.uom || ""}</td>
          </tr>
          ` : ""}
        </table>
        
        <h3>Description</h3>
        <p style="white-space: pre-wrap;">${requestOffer.description}</p>
      `;

      if (requestOffer.message_to_recipients) {
        htmlBody += `
          <h3>Additional Notes</h3>
          <p style="white-space: pre-wrap;">${requestOffer.message_to_recipients}</p>
        `;
      }

      if (attachmentLinks.length > 0) {
        htmlBody += `
          <h3>Attachments</h3>
          <ul>
            ${attachmentLinks.map((att) => `<li><a href="${att.url}">${att.name}</a></li>`).join("")}
          </ul>
        `;
      }

      htmlBody += `
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
        <p>Please reply to this email with your offer.</p>
        <p>Best regards,<br/>SKYNET Procurement Team</p>
      `;

      try {
        console.log(`Sending email to: ${email}`);
        
        const emailResponse = await resend.emails.send({
          from: "SKYNET Procurement <onboarding@resend.dev>",
          to: [email],
          subject: subject,
          html: htmlBody,
        });

        console.log(`Email response for ${email}:`, JSON.stringify(emailResponse));

        // Check if Resend returned an error (SDK doesn't throw on API errors)
        if (emailResponse.error) {
          const errorMsg = emailResponse.error.message || "Resend API error";
          console.error(`Resend error for ${email}:`, errorMsg);

          await supabase
            .from("request_offer_recipients")
            .update({
              status: "failed",
              error_message: errorMsg,
            })
            .eq("id", recipient.id);

          failedCount++;
          failures.push({ email, error: errorMsg });
        } else {
          // Email sent successfully
          await supabase
            .from("request_offer_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", recipient.id);

          sentCount++;
        }
      } catch (emailError: any) {
        console.error(`Exception sending email to ${email}:`, emailError);

        await supabase
          .from("request_offer_recipients")
          .update({
            status: "failed",
            error_message: emailError.message || "Unknown error",
          })
          .eq("id", recipient.id);

        failedCount++;
        failures.push({ email, error: emailError.message || "Unknown error" });
      }
    }

    // Update request offer status
    if (sentCount > 0) {
      await supabase
        .from("request_offers")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", request_offer_id);
    }

    console.log(`Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: sentCount,
        failed_count: failedCount,
        failures,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send_request_offer_email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
