import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-viber-content-signature',
};

// Send a text message via Viber API
async function sendViberMessage(receiverId: string, text: string, viberToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log(`Sending Viber message to ${receiverId}: ${text.substring(0, 50)}...`);
    
    const response = await fetch('https://chatapi.viber.com/pa/send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viber-Auth-Token': viberToken,
      },
      body: JSON.stringify({
        receiver: receiverId,
        type: 'text',
        text: text,
        sender: { name: 'SKYNET' },
      }),
    });

    const data = await response.json();
    console.log('Viber API response:', JSON.stringify(data));
    
    if (data.status === 0) {
      return { ok: true };
    } else {
      return { ok: false, error: data.status_message || `Error status: ${data.status}` };
    }
  } catch (error) {
    console.error('Error sending Viber message:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const viberToken = Deno.env.get('VIBER_AUTH_TOKEN');

    if (!supabaseUrl || !serviceRoleKey || !viberToken) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the webhook payload
    const payload = await req.json();
    console.log('Viber webhook payload:', JSON.stringify(payload));

    // Handle webhook callback verification
    if (payload.event === 'webhook') {
      console.log('Webhook verified');
      return new Response(JSON.stringify({ status: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only process message events
    if (payload.event !== 'message') {
      console.log(`Ignoring event: ${payload.event}`);
      return new Response(JSON.stringify({ status: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract sender and message
    const senderId = payload.sender?.id;
    const messageText = payload.message?.text?.trim();

    if (!senderId || !messageText) {
      console.log('Missing sender or message text');
      return new Response(JSON.stringify({ status: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Message from ${senderId}: ${messageText}`);

    // Check if message matches LINK command pattern (LINK followed by 6 digits)
    const linkMatch = messageText.match(/^LINK\s+(\d{6})$/i);

    if (!linkMatch) {
      // Not a LINK command - ignore or send help message
      console.log('Message does not match LINK pattern, ignoring');
      return new Response(JSON.stringify({ status: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkCode = linkMatch[1];
    console.log(`Processing LINK command with code: ${linkCode}`);

    // Create Supabase client with service role (bypass RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up the link code
    const { data: codeData, error: codeError } = await supabase
      .from('viber_link_codes')
      .select('id, employee_id')
      .eq('code', linkCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (codeError || !codeData) {
      console.log('Invalid or expired code:', codeError?.message);
      await sendViberMessage(
        senderId,
        '❌ Invalid or expired code. Please ask Admin/HR for a new linking code.',
        viberToken
      );
      return new Response(JSON.stringify({ status: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found valid code for employee: ${codeData.employee_id}`);

    // Upsert into employee_contact_channels
    const { error: channelError } = await supabase
      .from('employee_contact_channels')
      .upsert({
        employee_id: codeData.employee_id,
        channel_type: 'viber',
        channel_identifier: senderId,
        is_verified: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'employee_id,channel_type',
      });

    if (channelError) {
      console.error('Error upserting contact channel:', channelError);
      // Try insert if upsert fails (might not have unique constraint)
      const { error: insertError } = await supabase
        .from('employee_contact_channels')
        .insert({
          employee_id: codeData.employee_id,
          channel_type: 'viber',
          channel_identifier: senderId,
          is_verified: true,
        });
      
      if (insertError) {
        console.error('Error inserting contact channel:', insertError);
        await sendViberMessage(
          senderId,
          '❌ An error occurred. Please try again later.',
          viberToken
        );
        return new Response(JSON.stringify({ status: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Mark the link code as used
    const { error: updateError } = await supabase
      .from('viber_link_codes')
      .update({
        used_at: new Date().toISOString(),
        used_by_viber_user_id: senderId,
      })
      .eq('id', codeData.id);

    if (updateError) {
      console.error('Error updating link code:', updateError);
    }

    // Send success message
    await sendViberMessage(
      senderId,
      '✅ Linked successfully! You will now receive SKYNET announcements here.',
      viberToken
    );

    console.log('LINK command processed successfully');
    return new Response(JSON.stringify({ status: 0 }), {
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
