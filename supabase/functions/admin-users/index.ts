// Edge function: user management actions that require the service-role key.
// Only callable by an authenticated super_admin (verified server-side below).
//
// Actions:
//   { action: "invite", email: string, role: "editor" | "viewer" | "super_admin", fullName?: string }
//   { action: "revoke", userId: string }   — deletes the auth user (cascades to profile)
//
// Deploy: supabase functions deploy admin-users

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Identify the caller from their JWT and check their role via RLS-bypassing
    // service client against the profiles table.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Не авторизовано' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'super_admin') {
      return json({ error: 'Доступно лише суперадміністратору' }, 403);
    }

    const body = await req.json();

    if (body.action === 'invite') {
      const { email, role, fullName, redirectTo } = body;
      if (!email || !['super_admin', 'editor', 'viewer'].includes(role)) {
        return json({ error: 'Некоректні дані запрошення' }, 400);
      }
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role, full_name: fullName ?? '' },
        redirectTo,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ user: data.user });
    }

    if (body.action === 'revoke') {
      const { userId } = body;
      if (!userId || userId === caller.id) {
        return json({ error: 'Некоректний користувач' }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Невідома дія' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Помилка сервера' }, 500);
  }
});
