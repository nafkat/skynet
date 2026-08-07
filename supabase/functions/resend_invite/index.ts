import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendInviteRequest {
  user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can resend invitations" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id }: ResendInviteRequest = await req.json();
    console.log("Resend invite request for user:", user_id);

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(user_id);
    if (getUserError || !userData?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUser = userData.user;
    const userEmail = targetUser.email;

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User has no email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetUser.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "User has already accepted their invitation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await adminClient
      .from("profiles")
      .select("full_name, display_name")
      .eq("user_id", user_id)
      .maybeSingle();

    const displayName = profileData?.full_name || profileData?.display_name || userEmail.split("@")[0];

    // Generate a fresh invite link (invalidates previous invite tokens). Does NOT send email.
    const redirectTo = `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://skynetshipyard.app"}/setup-account`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: userEmail,
      options: {
        data: { full_name: displayName },
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Generate link error:", linkError);
      return new Response(JSON.stringify({ error: linkError?.message || "Failed to generate invite link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteUrl = linkData.properties.action_link;

    // Send via Resend (bypasses Supabase built-in SMTP rate limit)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Skynet Shipyard <${fromEmail}>`,
        to: [userEmail],
        subject: "Your invitation to Skynet Shipyard",
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
            <h2 style="margin:0 0 16px">Welcome${displayName ? `, ${displayName}` : ""}!</h2>
            <p>You have been invited to join <strong>Skynet Shipyard</strong>. Click the button below to accept your invitation and set up your account.</p>
            <p style="margin:32px 0">
              <a href="${inviteUrl}" style="background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Accept invitation</a>
            </p>
            <p style="font-size:12px;color:#64748b">If the button does not work, copy and paste this link:<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend send failed:", emailRes.status, errText);
      return new Response(JSON.stringify({ error: `Failed to send email: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("permission_audit_logs").insert({
      actor_user_id: currentUser.id,
      target_user_id: user_id,
      change_type: "INVITE_RESENT",
      details: { action: "RESEND_INVITE", email: userEmail, resent_at: new Date().toISOString() },
    });

    console.log("Invitation resent successfully for:", userEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation email has been resent", email: userEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
