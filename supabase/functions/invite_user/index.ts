import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: 'admin' | 'hr' | 'timekeeper';
  display_name?: string;
  custom_role_ids?: string[];
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if current user is admin
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, role, display_name, custom_role_ids }: InviteRequest = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    if (!["admin", "hr", "timekeeper"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate custom_role_ids if provided
    if (custom_role_ids && !Array.isArray(custom_role_ids)) {
      return new Response(
        JSON.stringify({ error: "custom_role_ids must be an array" }),
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

    // Ensure profile exists with display_name
    await adminClient.from("profiles").upsert({
      user_id: newUserId,
      full_name: display_name || email.split("@")[0],
      display_name: display_name || email.split("@")[0],
      is_active: true,
    }, { onConflict: "user_id" });

    // Set the user role
    await adminClient.from("user_roles").upsert({
      user_id: newUserId,
      role: role,
    }, { onConflict: "user_id,role" });

    // Determine if we should use custom role permissions or initialize with base role
    const hasCustomRole = custom_role_ids && custom_role_ids.length > 0;

    if (hasCustomRole) {
      // When custom role is selected:
      // 1. First initialize with base timekeeper permissions (creates all module/action records)
      // 2. Then override with template permissions
      
      console.log("Applying custom role permissions for template:", custom_role_ids[0]);
      
      // Initialize base permissions first (this creates all module/action records with defaults)
      await adminClient.rpc("initialize_user_permissions", {
        _user_id: newUserId,
        _role: role,
        _granted_by: currentUser.id,
      });
      
      const templateId = custom_role_ids[0];
      
      // Record the template assignment
      await adminClient.from("user_permission_templates").upsert({
        user_id: newUserId,
        template_id: templateId,
        assigned_by: currentUser.id,
        assigned_at: new Date().toISOString(),
      }, { onConflict: "user_id,template_id" });

      // Fetch template configuration
      const { data: templateModules } = await adminClient
        .from("permission_template_modules")
        .select("module_key, can_access")
        .eq("template_id", templateId);

      const { data: templateActions } = await adminClient
        .from("permission_template_actions")
        .select("action_key, allowed")
        .eq("template_id", templateId);

      console.log("Template modules:", templateModules);
      console.log("Template actions:", templateActions);

      // Override module access with template values
      for (const tm of templateModules || []) {
        await adminClient.from("user_module_access").upsert({
          user_id: newUserId,
          module_key: tm.module_key,
          can_access: tm.can_access,
          granted_by: currentUser.id,
        }, { onConflict: "user_id,module_key" });
      }

      // Override action permissions with template values
      for (const ta of templateActions || []) {
        await adminClient.from("user_module_actions").upsert({
          user_id: newUserId,
          action_key: ta.action_key,
          allowed: ta.allowed,
          granted_by: currentUser.id,
        }, { onConflict: "user_id,action_key" });
      }

      // Log template application
      const { data: templateInfo } = await adminClient
        .from("permission_templates")
        .select("name")
        .eq("id", templateId)
        .single();

      await adminClient.from("permission_audit_logs").insert({
        actor_user_id: currentUser.id,
        target_user_id: newUserId,
        change_type: "ROLE_ASSIGNED",
        details: { 
          template_id: templateId, 
          template_name: templateInfo?.name,
          role_type: "custom",
          base_role: role,
          email: email
        },
      });
    } else {
      // No custom role - initialize with base role permissions (admin/hr/timekeeper)
      await adminClient.rpc("initialize_user_permissions", {
        _user_id: newUserId,
        _role: role,
        _granted_by: currentUser.id,
      });

      // Log the role assignment
      await adminClient.from("permission_audit_logs").insert({
        actor_user_id: currentUser.id,
        target_user_id: newUserId,
        change_type: "ROLE_ASSIGNED",
        details: { action: "INVITE", role: role, role_type: "system", email: email },
      });
    }

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