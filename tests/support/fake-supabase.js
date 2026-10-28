// Nachbau der Teile von Supabase, die der Cloud-Sync nutzt (Anmeldung + Tabelle vaults mit Zugriffsregeln),
// für Tests ohne Internet. handle() verarbeitet eine Anfrage; fetch ist ein passender Ersatz für window.fetch.
// Wie bei Supabase sieht jede angemeldete Person nur ihre eigene Zeile.

export function createFakeSupabase({ confirmEmail = false } = {}) {
  const users = new Map(); // email → { id, password, confirmed }
  const tokens = new Map(); // access/refresh token → user id
  const vaults = new Map(); // user id → Zeile
  const requests = [];
  let counter = 0;

  const reply = (status, body) => ({ status, body });
  const issue = (user) => {
    counter += 1;
    const access = `access-${user.id}-${counter}`;
    const refresh = `refresh-${user.id}-${counter}`;
    tokens.set(access, user.id);
    tokens.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, user: { id: user.id, email: user.email } };
  };
  const filters = (search) => Object.fromEntries([...search.entries()]
    .filter(([k, v]) => k !== 'select' && v.startsWith('eq.')).map(([k, v]) => [k, v.slice(3)]));

  function handle({ method, url, headers = {}, body }) {
    const u = new URL(url);
    const data = body ? JSON.parse(body) : null;
    requests.push({ method, path: u.pathname + u.search, headers, body: body || '' });
    if (!headers.apikey) return reply(401, { message: 'No API key found in request' });

    if (u.pathname === '/auth/v1/signup') {
      if (users.has(data.email)) return reply(422, { msg: 'User already registered' });
      if (String(data.password).length < 6) return reply(422, { msg: 'Password should be at least 6 characters.' });
      counter += 1;
      const user = { id: `user-${counter}`, email: data.email, password: data.password, confirmed: !confirmEmail };
      users.set(data.email, user);
      return reply(200, confirmEmail ? { id: user.id, email: user.email } : issue(user));
    }
    if (u.pathname === '/auth/v1/token') {
      const grant = u.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = users.get(data.email);
        if (!user || user.password !== data.password) return reply(400, { error_description: 'Invalid login credentials' });
        if (!user.confirmed) return reply(400, { error_description: 'Email not confirmed' });
        return reply(200, issue(user));
      }
      if (grant === 'refresh_token') {
        const id = tokens.get(data.refresh_token);
        if (!id) return reply(400, { error_description: 'Invalid Refresh Token' });
        tokens.delete(data.refresh_token);
        return reply(200, issue([...users.values()].find((x) => x.id === id)));
      }
    }
    if (u.pathname === '/rest/v1/vaults') {
      const uid = tokens.get(String(headers.authorization || '').replace(/^Bearer /, ''));
      if (!uid) return reply(401, { message: 'JWT expired' });
      const where = filters(u.searchParams);
      const own = vaults.get(uid);
      const matches = own && (!where.user_id || where.user_id === uid) && (!where.version || String(own.version) === where.version);
      if (method === 'GET') return reply(200, matches ? [{ ...own }] : []);
      if (method === 'POST') {
        if (data.user_id !== uid) return reply(403, { message: 'new row violates row-level security policy' });
        if (vaults.has(uid)) return reply(409, { message: 'duplicate key value violates unique constraint' });
        vaults.set(uid, { ...data, user_id: uid });
        return reply(201, null);
      }
      if (method === 'PATCH') {
        if (!matches) return reply(200, []);
        Object.assign(own, data);
        return reply(200, [{ ...own }]);
      }
      if (method === 'DELETE') {
        if (matches) vaults.delete(uid);
        return reply(204, null);
      }
    }
    return reply(404, { message: `not found: ${method} ${u.pathname}` });
  }

  const fetch = async (url, { method = 'GET', headers = {}, body } = {}) => {
    const { status, body: json } = handle({ method, url, headers, body });
    const text = json === null ? '' : JSON.stringify(json);
    return { ok: status >= 200 && status < 300, status, text: async () => text };
  };

  return {
    handle, fetch, requests, vaults, users,
    confirm: (email) => { users.get(email).confirmed = true; },
    expireTokens: () => { for (const [t] of tokens) if (t.startsWith('access-')) tokens.delete(t); },
    revokeAll: () => tokens.clear(), // z. B. Passwort woanders geändert: alle Anmeldungen ungültig
  };
}
