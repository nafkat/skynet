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

    const { message_id, reply_text, attachment_url, attachment_name, attachment_type } = await req.json();

    if (!message_id || (!reply_text && !attachment_url)) {
      return new Response(JSON.stringify({ error: 'message_id and reply_text or attachment are required' }), {
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
    const chatId = message.telegram_chat_id;

    let telegramOk = false;

    if (attachment_url) {
      // Send attachment via Telegram
      const caption = reply_text
        ? `💬 <b>Reply from ${adminName}:</b>\n\n${reply_text}`
        : `💬 <b>Reply from ${adminName}</b>`;

      const isImage = attachment_type?.startsWith('image/');
      const method = isImage ? 'sendPhoto' : 'sendDocument';
      const fileField = isImage ? 'photo' : 'document';

      try {
        // Bucket is private; download via service role using either a stored
        // path or a legacy public URL.
        let fileBlob: Blob;
        const bucket = 'message-attachments';
        const publicMarker = `/storage/v1/object/public/${bucket}/`;
        let storagePath = attachment_url as string;
        if (storagePath.startsWith('http')) {
          const idx = storagePath.indexOf(publicMarker);
          if (idx !== -1) {
            storagePath = decodeURIComponent(storagePath.substring(idx + publicMarker.length));
          }
        }
        const { data: dlData, error: dlError } = await supabase.storage
          .from(bucket)
          .download(storagePath);
        if (dlError || !dlData) {
          // Fallback: legacy fully-qualified URL we couldn't parse — fetch it directly
          const fileResponse = await fetch(attachment_url);
          if (!fileResponse.ok) throw new Error('Failed to download attachment');
          fileBlob = await fileResponse.blob();
        } else {
          fileBlob = dlData;
        }

        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append(fileField, new File([fileBlob], attachment_name || 'file', { type: attachment_type || 'application/octet-stream' }));
        formData.append('caption', caption.substring(0, 1024));
        formData.append('parse_mode', 'HTML');

        const tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
          method: 'POST',
          body: formData,
        });

        const tgData = await tgResponse.json();
        if (tgData.ok) {
          telegramOk = true;
        } else {
          console.error(`Telegram ${method} failed:`, tgData);
          // Fallback: send as document if photo failed
          if (isImage) {
            const formData2 = new FormData();
            formData2.append('chat_id', chatId.toString());
            formData2.append('document', new File([fileBlob], attachment_name || 'file', { type: attachment_type || 'application/octet-stream' }));
            formData2.append('caption', caption.substring(0, 1024));
            formData2.append('parse_mode', 'HTML');

            const tgResponse2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
              method: 'POST',
              body: formData2,
            });
            const tgData2 = await tgResponse2.json();
            telegramOk = tgData2.ok;
            if (!tgData2.ok) console.error('Telegram sendDocument fallback failed:', tgData2);
          }
        }
      } catch (dlError) {
        console.error('Error downloading/sending attachment:', dlError);
        // Fallback: send text-only reply with link
        const fallbackText = `💬 <b>Reply from ${adminName}:</b>\n\n${reply_text || ''}\n\n📎 <a href="${attachment_url}">${attachment_name || 'Attachment'}</a>`;
        const fallbackResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: fallbackText, parse_mode: 'HTML' }),
        });
        const fallbackData = await fallbackResp.json();
        telegramOk = fallbackData.ok;
      }
    } else {
      // Text-only reply
      const telegramText = `💬 <b>Reply from ${adminName}:</b>\n\n${reply_text}`;
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: telegramText, parse_mode: 'HTML' }),
      });
      const telegramData = await response.json();
      telegramOk = telegramData.ok;
      if (!telegramData.ok) {
        console.error('Telegram send failed:', telegramData);
      }
    }

    if (!telegramOk) {
      return new Response(JSON.stringify({ error: 'Failed to send Telegram message' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update message record
    const updateData: Record<string, any> = {
      status: 'replied',
      admin_reply: reply_text || `📎 ${attachment_name || 'Attachment'}`,
      replied_at: new Date().toISOString(),
      replied_by: adminUserId,
    };

    if (attachment_url) {
      updateData.admin_attachment_url = attachment_url;
      updateData.admin_attachment_name = attachment_name;
      updateData.admin_attachment_type = attachment_type;
    }

    const { error: updateError } = await supabase
      .from('employee_messages')
      .update(updateData)
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
