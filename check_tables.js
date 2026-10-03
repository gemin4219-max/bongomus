const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/lib/supabase.ts', 'utf8');
const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if(urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    Promise.all([
        supabase.from('songs').select('*').limit(1),
        supabase.from('ai_songs').select('*').limit(1),
        supabase.from('tracks').select('*').limit(1)
    ]).then(([s, a, t]) => {
        console.log('songs:', s.error ? s.error.message : 'EXISTS');
        console.log('ai_songs:', a.error ? a.error.message : 'EXISTS');
        console.log('tracks:', t.error ? t.error.message : 'EXISTS');
    }).catch(e => console.error(e));
} else {
    console.log('Could not find supabase credentials in supabase.ts');
}
