import { corsHeaders, json, authenticatedUser, serviceClient } from '../_shared/google.ts';

const ADMIN_EMAIL = 'wiescudero@gmail.com';

const respond = (body: unknown, status = 200) => {
  const response = json(body, status);
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') return respond({ error: 'Método no permitido' }, 405);

  try {
    const user = await authenticatedUser(req);
    if (user.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
      return respond({ error: 'Acceso reservado al administrador' }, 403);
    }

    const { data, error } = await serviceClient().rpc('admin_dashboard_metrics');
    if (error) throw error;
    return respond({ stats: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el panel';
    const status = message.includes('Sesión') ? 401 : 500;
    return respond({ error: message }, status);
  }
});
