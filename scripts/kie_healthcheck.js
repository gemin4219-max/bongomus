// Health check of every KIE endpoint the app uses — no credits spent.
// Uses invalid IDs so the API validates the request and rejects it without creating a job.
const fs = require('fs'); const path = require('path');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SB = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const B = 'https://api.kie.ai/api/v1';
(async () => {
  const rows = await fetch(`${SB}/rest/v1/system_settings?select=key,value`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then(r => r.json());
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.kie_api_key}` };
  const fake = 'healthcheck000000000000000000000';
  const checks = [
    ['GET ', 'credit balance', `${B}/chat/credit`],
    ['GET ', 'task info (getTaskInfo)', `${B}/generate/record-info?taskId=${fake}`],
    ['GET ', 'vocal removal info', `${B}/vocal-removal/record-info?taskId=${fake}`],
    ['GET ', 'voice validate-info', `${B}/voice/validate-info?taskId=${fake}`],
    ['GET ', 'voice record-info', `${B}/voice/record-info?taskId=${fake}`],
    ['GET ', 'mp4 record-info', `${B}/mp4/record-info?taskId=${fake}`],
    ['POST', 'generate w/ bad persona', `${B}/generate`, { customMode: true, instrumental: false, model: 'V6', title: 'hc', style: 'Pop', prompt: 'x', personaId: fake, personaModel: 'voice_persona', callBackUrl: 'https://httpbin.org/post' }],
    ['POST', 'extend w/ bad audioId', `${B}/generate/extend`, { audioId: fake, model: 'V6', callBackUrl: 'https://httpbin.org/post', personaId: fake, personaModel: 'voice_persona' }],
    ['POST', 'generate-persona bad ids', `${B}/generate/generate-persona`, { taskId: fake, audioId: fake, name: 'hc', description: 'hc' }],
    ['POST', 'voice check-voice', `${B}/voice/check-voice`, { task_id: fake }],
    ['POST', 'voice regenerate bad id', `${B}/voice/regenerate`, { taskId: fake }],
    ['POST', 'vocal removal bad ids', `${B}/vocal-removal/generate`, { taskId: fake, audioId: fake, type: 'separate_vocal', callBackUrl: 'https://httpbin.org/post' }],
    ['POST', 'mp4 bad ids', `${B}/mp4/generate`, { taskId: fake, audioId: fake, callBackUrl: 'https://httpbin.org/post' }],
  ];
  for (const [m, name, url, body] of checks) {
    try {
      const r = await fetch(url, { method: m.trim(), headers: H, ...(body ? { body: JSON.stringify(body) } : {}) });
      const t = (await r.text()).replace(/\s+/g, ' ').slice(0, 150);
      const alive = r.status !== 404 && !/not found|no static resource|path/i.test(t.slice(0, 60)) ;
      console.log(`${alive ? 'OK  ' : 'DEAD'} ${m} ${name.padEnd(26)} HTTP ${r.status} ${t}`);
    } catch (e) { console.log(`ERR  ${m} ${name}: ${e.message}`); }
  }
  const after = await fetch(`${B}/chat/credit`, { headers: H }).then(r => r.json());
  console.log('credits after checks:', after.data);
})();
