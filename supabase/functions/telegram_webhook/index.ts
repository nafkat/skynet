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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    console.log('Telegram API response:', JSON.stringify(data));
    
    return data.ok ? { ok: true } : { ok: false, error: data.description || 'Unknown error' };
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check for /link command first
    const linkMatch = messageText?.match(/^\/link\s+(\d{6})$/i);

    if (linkMatch) {
      // Handle /link command
      const linkCode = linkMatch[1];
      console.log(`Processing /link command with code: ${linkCode}`);

      const { data: codeData, error: codeError } = await supabase
        .from('viber_link_codes')
        .select('id, employee_id')
        .eq('code', linkCode)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (codeError || !codeData) {
        console.log('Invalid or expired code:', codeError?.message);
        await sendTelegramMessage(chatId, '❌ Invalid or expired code.\n\nPlease ask your admin or HR for a new linking code.');
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
        }, { onConflict: 'employee_id,channel_type' });

      if (channelError) {
        console.error('Error upserting contact channel:', channelError);
        await sendTelegramMessage(chatId, '❌ An error occurred while linking your account.\n\nPlease try again later or contact support.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('viber_link_codes')
        .update({ used_at: new Date().toISOString(), used_by_viber_user_id: userId.toString() })
        .eq('id', codeData.id);

      if (updateError) console.error('Error updating link code:', updateError);

      await sendTelegramMessage(chatId, '✅ <b>Linked successfully!</b>\n\nYou will now receive SKYNET announcements here.\nYou can also send messages to your admin directly through this chat.');

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle /start command
    if (messageText === '/start') {
      await sendTelegramMessage(
        chatId,
        '👋 Welcome to SKYNET!\n\nTo link your account, use:\n/link [6-digit code]\n\nGet your linking code from your admin or HR.\n\nOnce linked, you can send messages directly to your admin through this chat.'
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For any other message, check if user is linked
    const { data: channelData, error: channelErr } = await supabase
      .from('employee_contact_channels')
      .select('employee_id')
      .eq('channel_type', 'telegram')
      .eq('channel_identifier', userId.toString())
      .eq('is_verified', true)
      .maybeSingle();

    if (channelErr || !channelData) {
      console.log('Unlinked user sent a message, ignoring');
      await sendTelegramMessage(chatId, '⚠️ Your account is not linked.\n\nUse /link [6-digit code] to link your account first.');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine message type and content
    let msgType = 'text';
    let msgText = messageText || '';
    let attachmentFileId: string | null = null;
    let attachmentFileName: string | null = null;

    if (payload.message.photo) {
      msgType = 'image';
      const photos = payload.message.photo;
      attachmentFileId = photos[photos.length - 1].file_id;
      msgText = payload.message.caption || '';
      attachmentFileName = `photo_${Date.now()}.jpg`;
    } else if (payload.message.document) {
      msgType = 'file';
      attachmentFileId = payload.message.document.file_id;
      attachmentFileName = payload.message.document.file_name || `document_${Date.now()}`;
      msgText = payload.message.caption || payload.message.document.file_name || '';
    } else if (payload.message.voice) {
      msgType = 'file';
      attachmentFileId = payload.message.voice.file_id;
      attachmentFileName = `voice_${Date.now()}.ogg`;
      msgText = msgText || '🎤 Voice message';
    } else if (payload.message.video) {
      msgType = 'file';
      attachmentFileId = payload.message.video.file_id;
      attachmentFileName = payload.message.video.file_name || `video_${Date.now()}.mp4`;
      msgText = payload.message.caption || '🎥 Video';
    }

    if (!msgText && !attachmentFileId) {
      console.log('Empty message, ignoring');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download and store attachment if present
    let attachmentUrl: string | null = null;

    if (attachmentFileId) {
      try {
        // Get file path from Telegram
        const fileInfoResp = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${attachmentFileId}`
        );
        const fileInfoData = await fileInfoResp.json();

        if (fileInfoData.ok && fileInfoData.result.file_path) {
          // Download file from Telegram
          const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfoData.result.file_path}`;
          const fileResp = await fetch(fileDownloadUrl);

          if (fileResp.ok) {
            const fileBlob = await fileResp.blob();
            const messageId = crypto.randomUUID();
            const storagePath = `${channelData.employee_id}/${messageId}/${attachmentFileName}`;

            const { error: uploadError } = await supabase.storage
              .from('employee-attachments')
              .upload(storagePath, fileBlob, {
                contentType: fileBlob.type || 'application/octet-stream',
                upsert: false,
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('employee-attachments')
                .getPublicUrl(storagePath);
              attachmentUrl = urlData.publicUrl;
              console.log('Attachment uploaded:', attachmentUrl);
            } else {
              console.error('Storage upload error:', uploadError);
            }
          } else {
            console.error('Failed to download file from Telegram');
          }
        } else {
          console.error('Failed to get file info:', fileInfoData);
        }
      } catch (dlErr) {
        console.error('Error downloading/uploading attachment:', dlErr);
      }
    }

    // Store message in database
    const { error: insertError } = await supabase
      .from('employee_messages')
      .insert({
        employee_id: channelData.employee_id,
        telegram_chat_id: chatId,
        message_text: msgText,
        message_type: msgType,
        attachment_file_id: attachmentFileId,
        attachment_url: attachmentUrl,
        attachment_name: attachmentFileName,
        status: 'unread',
      });

    if (insertError) {
      console.error('Error storing message:', insertError);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send confirmation to employee
    await sendTelegramMessage(chatId, '✅ Μήνυμα ελήφθη! Ο διαχειριστής θα απαντήσει σύντομα.\n\n✅ Message received! Admin will respond soon.');

    console.log('Employee message stored successfully');
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
