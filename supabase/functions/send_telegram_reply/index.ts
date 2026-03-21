import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey || !TELEGRAM_BOT_TOKEN) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = claimsData.claims.sub;

    const { message_id, reply_text } = await req.json();

    if (!message_id || !reply_text) {
      return new Response(JSON.stringify({ error: 'message_id and reply_text are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .in('role', ['admin', 'hr'])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get message details
    const { data: message, error: msgError } = await supabase
      .from('employee_messages')
      .select('id, telegram_chat_id, employee_id, employees(first_name, last_name)')
      .eq('id', message_id)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get admin name
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('user_id', adminUserId)
      .single();

    const adminName = adminProfile?.display_name || adminProfile?.full_name || 'Admin';

    // Send reply via Telegram
    const telegramText = `💬 <b>Reply from ${adminName}:</b>\n\n${reply_text}`;
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.telegram_chat_id,
        text: telegramText,
        parse_mode: 'HTML',
      }),
    });

    const telegramData = await response.json();
    
    if (!telegramData.ok) {
      console.error('Telegram send failed:', telegramData);
      return new Response(JSON.stringify({ error: 'Failed to send Telegram message', details: telegramData.description }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update message record
    const { error: updateError } = await supabase
      .from('employee_messages')
      .update({
        status: 'replied',
        admin_reply: reply_text,
        replied_at: new Date().toISOString(),
        replied_by: adminUserId,
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
