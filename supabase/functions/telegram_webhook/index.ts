import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

async function sendTelegramMessage(chatId: string | number, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log(`Sending Telegram message to ${chatId}: ${text.substring(0, 50)}...`);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    console.log('Telegram API response:', JSON.stringify(data));
    
    if (data.ok) {
      return { ok: true };
    } else {
      return { ok: false, error: data.description || 'Unknown error' };
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey || !TELEGRAM_BOT_TOKEN) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    console.log('Telegram webhook payload:', JSON.stringify(payload));

    if (!payload.message) {
      console.log('Ignoring non-message update');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = payload.message.chat.id;
    const messageText = payload.message.text?.trim();
    const userId = payload.message.from.id;

    if (!messageText) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Message from ${userId}: ${messageText}`);

    const linkMatch = messageText.match(/^\/link\s+(\d{6})$/i);

    if (!linkMatch) {
      if (messageText === '/start') {
        await sendTelegramMessage(
          chatId,
          '👋 Welcome to SKYNET!\n\nTo link your account, use:\n/link [6-digit code]\n\nGet your linking code from your admin or HR.'
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkCode = linkMatch[1];
    console.log(`Processing /link command with code: ${linkCode}`);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: codeData, error: codeError } = await supabase
      .from('viber_link_codes')
      .select('id, employee_id')
      .eq('code', linkCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (codeError || !codeData) {
      console.log('Invalid or expired code:', codeError?.message);
      await sendTelegramMessage(
        chatId,
        '❌ Invalid or expired code.\n\nPlease ask your admin or HR for a new linking code.'
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found valid code for employee: ${codeData.employee_id}`);

    const { error: channelError } = await supabase
      .from('employee_contact_channels')
      .upsert({
        employee_id: codeData.employee_id,
        channel_type: 'telegram',
        channel_identifier: userId.toString(),
        is_verified: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'employee_id,channel_type',
      });

    if (channelError) {
      console.error('Error upserting contact channel:', channelError);
      await sendTelegramMessage(
        chatId,
        '❌ An error occurred while linking your account.\n\nPlease try again later or contact support.'
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('viber_link_codes')
      .update({
        used_at: new Date().toISOString(),
        used_by_viber_user_id: userId.toString(),
      })
      .eq('id', codeData.id);

    if (updateError) {
      console.error('Error updating link code:', updateError);
    }

    await sendTelegramMessage(
      chatId,
      '✅ <b>Linked successfully!</b>\n\nYou will now receive SKYNET announcements here.\n\nYou can close this chat or use /start to see this message again.'
    );

    console.log('/link command processed successfully');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
