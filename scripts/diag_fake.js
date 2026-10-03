const fs = require('fs'); const path = require('path');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SB = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
(async () => {
  const s = Object.fromEntries((await fetch(`${SB}/rest/v1/system_settings?select=key,value&key=eq.kie_api_key`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then(r => r.json())).map(r => [r.key, r.value]));
  const apiKey = s.kie_api_key, base = 'https://api.kie.ai/api/v1';
  const id = process.argv[2] || 'fake-voice-id-123';
  for (const [model, pm] of [['V5_5','voice_persona'],['V6','voice_persona']]) {
    const body = { customMode: true, instrumental: false, model, title: 'diag', style: 'Pop', prompt: 'test', personaId: id, personaModel: pm, callBackUrl: 'https://httpbin.org/post' };
    const r = await fetch(`${base}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    console.log(`[${model}/${pm}] HTTP ${r.status}: ${await r.text()}`);
  }
})();
