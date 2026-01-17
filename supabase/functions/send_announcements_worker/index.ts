import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Create Supabase client with service role (bypass RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Starting announcement delivery worker...');

    // Fetch up to 50 pending deliveries
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
      .eq('channel', 'viber')
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

    // Track results for announcement status updates
    const announcementResults: Record<string, { sent: number; failed: number; total: number }> = {};

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      processed++;
      const employeeId = (delivery.announcement_recipients as any)?.employee_id;
      const announcementId = delivery.announcement_id;

      // Initialize tracking for this announcement
      if (!announcementResults[announcementId]) {
        announcementResults[announcementId] = { sent: 0, failed: 0, total: 0 };
      }
      announcementResults[announcementId].total++;

      if (!employeeId) {
        console.error(`No employee_id found for delivery ${delivery.id}`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'failed',
            error_message: 'No employee found for recipient',
            attempts: delivery.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      // Get viber_user_id from employee_contact_channels
      const { data: contactChannel, error: contactError } = await supabase
        .from('employee_contact_channels')
        .select('channel_identifier, is_verified')
        .eq('employee_id', employeeId)
        .eq('channel_type', 'viber')
        .single();

      if (contactError || !contactChannel?.channel_identifier) {
        console.log(`Employee ${employeeId} not subscribed to Viber`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'failed',
            error_message: 'Employee not subscribed to Viber',
            attempts: delivery.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      // Get announcement content
      const { data: announcement, error: announcementError } = await supabase
        .from('announcements')
        .select('title, message')
        .eq('id', announcementId)
        .single();

      if (announcementError || !announcement) {
        console.error(`Announcement ${announcementId} not found`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'failed',
            error_message: 'Announcement not found',
            attempts: delivery.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        failed++;
        announcementResults[announcementId].failed++;
        continue;
      }

      // Build message text
      const messageText = `📢 ${announcement.title}\n\n${announcement.message}`;

      // Send via Viber
      const result = await sendViberMessage(contactChannel.channel_identifier, messageText, viberToken);

      if (result.ok) {
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
        console.error(`Delivery ${delivery.id} failed: ${result.error}`);
        await supabase
          .from('announcement_deliveries')
          .update({
            status: 'failed',
            error_message: result.error || 'Unknown error',
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
      // Get total delivery count for this announcement
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

      // Determine announcement status
      let newStatus: string;
      if (pendingCount && pendingCount > 0) {
        // Still have pending deliveries
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
