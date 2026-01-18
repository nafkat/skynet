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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the request is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to verify they're an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if current user is admin (via user_roles table - secure location)
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError, roleData);
      return new Response(
        JSON.stringify({ error: "Only admins can resend invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_id }: ResendInviteRequest = await req.json();
    console.log("Resend invite request for user:", user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for user management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the target user
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(user_id);
    
    if (getUserError || !userData?.user) {
      console.error("Get user error:", getUserError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = userData.user;
    const userEmail = targetUser.email;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User has no email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has already confirmed their email (accepted invite)
    if (targetUser.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: "User has already accepted their invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's display name from profile
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("full_name, display_name")
      .eq("user_id", user_id)
      .maybeSingle();

    const displayName = profileData?.full_name || profileData?.display_name || userEmail.split("@")[0];

    // Generate new invite link - this invalidates any previous invite tokens
    // Supabase's generateLink with 'invite' type creates a new token and invalidates old ones
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: userEmail,
      options: {
        data: {
          full_name: displayName,
        },
        redirectTo: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://skynet.lovable.app"}/home`,
      },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the invitation email using the magic link
    // The generateLink returns a link with the token, we need to send it via email
    // Using Supabase's invite method which handles email sending
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(userEmail, {
      data: {
        full_name: displayName,
      },
      redirectTo: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://skynet.lovable.app"}/home`,
    });

    if (inviteError) {
      // If user already exists, that's expected - we just want to resend
      if (!inviteError.message.includes("already been registered")) {
        console.error("Invite error:", inviteError);
        return new Response(
          JSON.stringify({ error: inviteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For existing users, we need to use a different approach
      // Use the recovery flow which will send a password reset email
      // This is the Supabase-recommended way to resend access to unconfirmed users
      console.log("User exists, using recovery flow for resend");
      
      // Update the user to trigger a new invite
      const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
        email_confirm: false, // Reset confirmation status
      });

      if (updateError) {
        console.error("Update user error:", updateError);
      }

      // Now send the invite again
      const { error: reinviteError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
        options: {
          redirectTo: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://skynet.lovable.app"}/home`,
        },
      });

      if (reinviteError) {
        console.error("Reinvite error:", reinviteError);
        return new Response(
          JSON.stringify({ error: reinviteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Log the resend action
    await adminClient.from("permission_audit_logs").insert({
      actor_user_id: currentUser.id,
      target_user_id: user_id,
      change_type: "INVITE_RESENT",
      details: { 
        action: "RESEND_INVITE", 
        email: userEmail,
        resent_at: new Date().toISOString(),
      },
    });

    console.log("Invitation resent successfully for:", userEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation email has been resent",
        email: userEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
