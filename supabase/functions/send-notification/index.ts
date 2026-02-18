// Supabase Edge Function: send-notification
// Triggered by database webhooks on game_players and settlements INSERT
// Sends push notifications via the Expo Push API

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: Record<string, any>;
  schema: string;
}

async function sendPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      sound: 'default',
      data,
    }),
  });
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const { table, record } = payload;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (table === 'game_players') {
      // ── Game Invite Notification ──
      const targetUserId = record.user_id;
      const gameId = record.game_id;

      // Get game info
      const { data: game } = await supabaseAdmin
        .from('games')
        .select('created_by, course_name')
        .eq('id', gameId)
        .single();

      if (!game) {
        return new Response(JSON.stringify({ skipped: true, reason: 'game_not_found' }), {
          status: 200,
        });
      }

      // Don't notify the game creator for their own row
      if (game.created_by === targetUserId) {
        return new Response(JSON.stringify({ skipped: true, reason: 'creator' }), {
          status: 200,
        });
      }

      // Get creator name
      const { data: creator } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', game.created_by)
        .single();

      // Get target user's push token
      const { data: targetUser } = await supabaseAdmin
        .from('users')
        .select('push_token')
        .eq('id', targetUserId)
        .single();

      if (!targetUser?.push_token) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_push_token' }), {
          status: 200,
        });
      }

      const creatorName = creator?.name ?? 'Someone';
      const courseName = game.course_name ?? 'a round';

      await sendPush(targetUser.push_token, 'Game Invite', `${creatorName} invited you to ${courseName}`, {
        type: 'game_invite',
        gameId,
      });

      return new Response(JSON.stringify({ sent: true, table: 'game_players' }), {
        status: 200,
      });
    }

    if (table === 'settlements') {
      // ── Settlement Ready Notification ──
      const gameId = record.game_id;
      const fromUserId = record.from_user_id;
      const toUserId = record.to_user_id;
      const amount = Number(record.amount).toFixed(2);

      // Get game info
      const { data: game } = await supabaseAdmin
        .from('games')
        .select('course_name')
        .eq('id', gameId)
        .single();

      const courseName = game?.course_name ?? 'your game';

      // Notify the person who owes money
      if (fromUserId) {
        const { data: fromUser } = await supabaseAdmin
          .from('users')
          .select('push_token')
          .eq('id', fromUserId)
          .single();

        if (fromUser?.push_token) {
          await sendPush(fromUser.push_token, 'Settlement Ready', `You owe $${amount} for ${courseName}`, {
            type: 'settlement_ready',
            gameId,
          });
        }
      }

      // Notify the person who is owed money
      if (toUserId) {
        const { data: toUser } = await supabaseAdmin
          .from('users')
          .select('push_token')
          .eq('id', toUserId)
          .single();

        if (toUser?.push_token) {
          await sendPush(toUser.push_token, 'Settlement Ready', `You're owed $${amount} for ${courseName}`, {
            type: 'settlement_ready',
            gameId,
          });
        }
      }

      return new Response(JSON.stringify({ sent: true, table: 'settlements' }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ skipped: true, reason: 'unknown_table' }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
});
