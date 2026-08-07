import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: string, text: string, telegramToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log(`Sending Telegram message to ${chatId}: ${text.substring(0, 50)}...`);
    
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
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
    
    if (data.ok) {
      return { ok: true };
    } else {
      return { ok: false, error: data.description || `Error: ${JSON.stringify(data)}` };
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendTelegramDocument(
  chatId: string,
  fileBytes: Uint8Array,
  fileName: string,
  caption: string,
  telegramToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log(`Sending Telegram document "${fileName}" to ${chatId}...`);

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fileBytes]), fileName);
    // Telegram caption max is 1024 chars
    if (caption) {
      formData.append('caption', caption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('Telegram sendDocument response:', JSON.stringify(data));

    if (data.ok) {
      return { ok: true };
    } else {
      return { ok: false, error: data.description || `Error: ${JSON.stringify(data)}` };
    }
  } catch (error) {
    console.error('Error sending Telegram document:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendTelegramPhoto(
  chatId: string,
  fileBytes: Uint8Array,
  fileName: string,
  caption: string,
  telegramToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log(`Sending Telegram photo "${fileName}" to ${chatId}...`);

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([fileBytes]), fileName);
    if (caption) {
      formData.append('caption', caption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('Telegram sendPhoto response:', JSON.stringify(data));

    if (data.ok) {
      return { ok: true };
    } else {
      return { ok: false, error: data.description || `Error: ${JSON.stringify(data)}` };
    }
  } catch (error) {
    console.error('Error sending Telegram photo:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
}

// Cache for announcement data to avoid repeated queries
const announcementCache: Record<string, { title: string; message: string; attachments: Attachment[] }> = {};

async function getAnnouncementWithAttachments(
  supabase: any,
  announcementId: string
): Promise<{ title: string; message: string; attachments: Attachment[] } | null> {
  if (announcementCache[announcementId]) {
    return announcementCache[announcementId];
  }

  const { data: announcement, error: announcementError } = await supabase
    .from('announcements')
    .select('title, message')
    .eq('id', announcementId)
    .single();

  if (announcementError || !announcement) {
    console.error(`Announcement ${announcementId} not found`);
    return null;
  }

  const { data: attachments, error: attachError } = await supabase
    .from('announcement_attachments')
    .select('id, file_name, file_path, mime_type')
    .eq('announcement_id', announcementId);

  if (attachError) {
    console.error(`Error fetching attachments for ${announcementId}:`, attachError);
  }

  const result = {
    title: announcement.title,
    message: announcement.message,
    attachments: attachments || [],
  };

  announcementCache[announcementId] = result;
  return result;
}

async function downloadFile(supabase: any, filePath: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage
      .from('announcements')
      .download(filePath);

    if (error) {
      console.error(`Error downloading file ${filePath}:`, error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`Exception downloading file ${filePath}:`, error);
    return null;
  }
}

function isImageMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/') && !mimeType.includes('svg');
}

async function markDeliveryFailed(supabase: any, deliveryId: string, errorMessage: string, attempts: number) {
  await supabase
    .from('announcement_deliveries')
    .update({
      status: 'failed',
      error_message: errorMessage,
      attempts: attempts + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!supabaseUrl || !serviceRoleKey || !telegramToken) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- Authentication & authorization ---
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('ANNOUNCEMENTS_WORKER_SECRET');
    const providedSecret = req.headers.get('x-worker-secret');
    const isCron = !!cronSecret && providedSecret === cronSecret;

    if (!isCron) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const jwt = authHeader.replace('Bearer ', '');
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt);
      const userId = claimsData?.claims?.sub as string | undefined;
      if (claimsError || !userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [{ data: modAllowed }, { data: elevated }] = await Promise.all([
        supabase.rpc('has_permission', { _user_id: userId, _permission_key: 'module.announcements' }),
        supabase.rpc('has_elevated_role', { _user_id: userId }),
      ]);
      if (modAllowed !== true && elevated !== true) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Starting announcement delivery worker...');

    const { data: deliveries, error: fetchError } = await supabase
      .from('announcement_deliveries')
      .select(`
        id,
        announcement_id,
        recipient_id,
        channel,
        status,
        attempts,
        announcement_recipients!inner (
          employee_id
        )
      `)
      .eq('status', 'pending')
      .eq('channel', 'telegram')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching deliveries:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch deliveries', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!deliveries || deliveries.length === 0) {
      console.log('No pending deliveries found');
      return new Response(JSON.stringify({ message: 'No pending deliveries', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${deliveries.length} pending deliveries to process`);

    const announcementResults: Record<string, { sent: number; failed: number; total: number }> = {};

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      processed++;
      const employeeId = (delivery.announcement_recipients as any)?.employee_id;
      const announcementId = delivery.announcement_id;

      if (!announcementResults[announcementId]) {
        announcementResults[announcementId] = { sent: 0, failed: 0, total: 0 };
      }
      announcementResults[announcementId].total++;

      if (!employeeId) {
        console.error(`No employee_id found for delivery ${delivery.id}`);
        await markDeliveryFailed(supabase, delivery.id, 'No employee found for recipient', delivery.attempts);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      // Get contact channel
      const { data: contactChannel, error: contactError } = await supabase
        .from('employee_contact_channels')
        .select('channel_identifier, is_verified')
        .eq('employee_id', employeeId)
        .eq('channel_type', 'telegram')
        .single();

      if (contactError || !contactChannel?.channel_identifier) {
        console.log(`Employee ${employeeId} not subscribed to Telegram`);
        await markDeliveryFailed(supabase, delivery.id, 'Employee not subscribed to Telegram', delivery.attempts);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      // Get announcement with attachments
      const announcementData = await getAnnouncementWithAttachments(supabase, announcementId);

      if (!announcementData) {
        await markDeliveryFailed(supabase, delivery.id, 'Announcement not found', delivery.attempts);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      const chatId = contactChannel.channel_identifier;
      const messageText = `📢 <b>${announcementData.title}</b>\n\n${announcementData.message}`;
      let allSucceeded = true;
      let lastError = '';

      if (announcementData.attachments.length === 0) {
        // No attachments - send text only
        const result = await sendTelegramMessage(chatId, messageText, telegramToken);
        if (!result.ok) {
          allSucceeded = false;
          lastError = result.error || 'Unknown error';
        }
      } else {
        // Has attachments - send first attachment with caption, rest without
        for (let i = 0; i < announcementData.attachments.length; i++) {
          const attachment = announcementData.attachments[i];
          const caption = i === 0 ? messageText : '';

          // Download file from storage
          const fileBytes = await downloadFile(supabase, attachment.file_path);

          if (!fileBytes) {
            console.error(`Failed to download attachment: ${attachment.file_path}`);
            // If first attachment fails, send text message instead
            if (i === 0) {
              const textResult = await sendTelegramMessage(chatId, messageText, telegramToken);
              if (!textResult.ok) {
                allSucceeded = false;
                lastError = textResult.error || 'Failed to send text fallback';
              }
            }
            continue;
          }

          // Send as photo if image, otherwise as document
          let result: { ok: boolean; error?: string };
          if (isImageMimeType(attachment.mime_type)) {
            result = await sendTelegramPhoto(chatId, fileBytes, attachment.file_name, caption, telegramToken);
            // If photo fails (e.g. too large), retry as document
            if (!result.ok) {
              console.log(`Photo send failed, retrying as document: ${result.error}`);
              result = await sendTelegramDocument(chatId, fileBytes, attachment.file_name, caption, telegramToken);
            }
          } else {
            result = await sendTelegramDocument(chatId, fileBytes, attachment.file_name, caption, telegramToken);
          }

          if (!result.ok) {
            allSucceeded = false;
            lastError = result.error || 'Unknown error';
            console.error(`Failed to send attachment ${attachment.file_name}: ${lastError}`);
            // If first attachment failed, try sending text at least
            if (i === 0) {
              await sendTelegramMessage(chatId, messageText, telegramToken);
            }
          }
        }
      }

      if (allSucceeded) {
        console.log(`Delivery ${delivery.id} sent successfully`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempts: delivery.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', delivery.id);
        sent++;
        announcementResults[announcementId].sent++;
      } else {
        console.error(`Delivery ${delivery.id} failed: ${lastError}`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'failed',
            error_message: lastError || 'Unknown error',
            attempts: delivery.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        failed++;
        announcementResults[announcementId].failed++;
      }
    }

    // Update announcement statuses
    for (const [announcementId, results] of Object.entries(announcementResults)) {
      const { count: totalDeliveries } = await supabase
        .from('announcement_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('announcement_id', announcementId);

      const { count: sentCount } = await supabase
        .from('announcement_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('announcement_id', announcementId)
        .eq('status', 'sent');

      const { count: failedCount } = await supabase
        .from('announcement_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('announcement_id', announcementId)
        .eq('status', 'failed');

      const { count: pendingCount } = await supabase
        .from('announcement_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('announcement_id', announcementId)
        .eq('status', 'pending');

      let newStatus: string;
      if (pendingCount && pendingCount > 0) {
        newStatus = 'pending';
      } else if (sentCount === totalDeliveries) {
        newStatus = 'sent';
      } else if (failedCount === totalDeliveries) {
        newStatus = 'failed';
      } else {
        newStatus = 'partial';
      }

      console.log(`Updating announcement ${announcementId} status to ${newStatus}`);

      const updateData: any = { status: newStatus };
      if (newStatus === 'sent') {
        updateData.sent_at = new Date().toISOString();
      }

      await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', announcementId);
    }

    console.log(`Worker completed: ${processed} processed, ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({
      message: 'Worker completed',
      processed,
      sent,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
