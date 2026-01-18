import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  base_role: 'admin' | 'employee';
  display_name?: string;
  template_ids?: string[]; // Multiple templates can be assigned
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

    // Check if current user is admin (by base_role in profiles)
    const { data: profileData, error: profileError } = await userClient
      .from("profiles")
      .select("base_role")
      .eq("user_id", currentUser.id)
      .single();

    if (profileError || profileData?.base_role !== "admin") {
      console.error("Role check failed:", profileError, profileData);
      return new Response(
        JSON.stringify({ error: "Only admins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, base_role, display_name, template_ids }: InviteRequest = await req.json();
    console.log("Invite request:", { email, base_role, display_name, template_ids });

    if (!email || !base_role) {
      return new Response(
        JSON.stringify({ error: "Email and base_role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base_role
    if (!["admin", "employee"].includes(base_role)) {
      return new Response(
        JSON.stringify({ error: "Invalid base_role. Must be 'admin' or 'employee'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for user management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite the user via magic link
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: display_name || email.split("@")[0],
      },
      redirectTo: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://skynet.lovable.app"}/home`,
    });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = inviteData.user.id;
    console.log("User invited successfully:", newUserId);

    // Create profile with base_role
    const { error: profileInsertError } = await adminClient.from("profiles").upsert({
      user_id: newUserId,
      full_name: display_name || email.split("@")[0],
      display_name: display_name || email.split("@")[0],
      is_active: true,
      base_role: base_role,
    }, { onConflict: "user_id" });

    if (profileInsertError) {
      console.error("Profile insert error:", profileInsertError);
    }

    // Also keep user_roles for backward compatibility with existing RLS policies
    await adminClient.from("user_roles").upsert({
      user_id: newUserId,
      role: base_role === 'admin' ? 'admin' : 'timekeeper', // Map employee to timekeeper for old RLS
    }, { onConflict: "user_id,role" });

    // Assign templates if provided
    const validTemplateIds = (template_ids || []).filter(id => id && id !== 'none');
    
    if (validTemplateIds.length > 0) {
      console.log("Assigning templates:", validTemplateIds);
      
      // Insert template assignments
      for (const templateId of validTemplateIds) {
        const { error: assignError } = await adminClient.from("user_permission_templates").insert({
          user_id: newUserId,
          template_id: templateId,
          assigned_by: currentUser.id,
        });
        
        if (assignError) {
          console.error("Template assignment error:", assignError);
        }
      }
      
      // Recompute effective permissions
      const { error: recomputeError } = await adminClient.rpc("recompute_user_permissions", {
        _user_id: newUserId,
      });
      
      if (recomputeError) {
        console.error("Recompute permissions error:", recomputeError);
      }

      // Get template names for audit log
      const { data: templateNames } = await adminClient
        .from("permission_templates")
        .select("id, name")
        .in("id", validTemplateIds);

      // Log template assignments
      await adminClient.from("permission_audit_logs").insert({
        actor_user_id: currentUser.id,
        target_user_id: newUserId,
        change_type: "TEMPLATES_ASSIGNED",
        details: { 
          template_ids: validTemplateIds, 
          template_names: templateNames?.map(t => t.name) || [],
        },
      });
    }

    // Log the invitation
    await adminClient.from("permission_audit_logs").insert({
      actor_user_id: currentUser.id,
      target_user_id: newUserId,
      change_type: "USER_INVITED",
      details: { 
        action: "INVITE", 
        base_role: base_role, 
        email: email, 
        template_ids: validTemplateIds,
      },
    });

    console.log("Invitation complete");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: "Invitation sent successfully" 
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
