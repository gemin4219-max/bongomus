const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gqxdbwnmnqvtdpxnrgtx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeGRid25tbnF2dGRweG5yZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTkxODQsImV4cCI6MjA5ODQ5NTE4NH0.tR0UOoPtscMbIpQCkjMPQ3n8vtBWIEIyhOqHIUX3uS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Promise.all([
    supabase.from('songs').select('*').limit(1),
    supabase.from('ai_songs').select('*').limit(1),
    supabase.from('tracks').select('*').limit(1)
]).then(([s, a, t]) => {
    console.log('songs:', s.error ? s.error.message : 'EXISTS (count: ' + s.data?.length + ')');
    console.log('ai_songs:', a.error ? a.error.message : 'EXISTS (count: ' + a.data?.length + ')');
    console.log('tracks:', t.error ? t.error.message : 'EXISTS (count: ' + t.data?.length + ')');
}).catch(e => console.error(e));
