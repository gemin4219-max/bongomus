const fs = require('fs');
let code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', 'utf8');

const target2 = `  // Audio state
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);`;
const replacement2 = `  // Audio state
  useEffect(() => {
    if (session?.user?.id && setTasks) {
      supabase.from('tracks')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_ai', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            const mappedTasks = data.map(track => ({
              taskId: track.id,
              title: track.title || 'Untitled',
              status: 'SUCCESS',
              createdAt: new Date(track.created_at).getTime(),
              taskType: 'GENERATE',
              tracks: [{
                id: track.id,
                audioUrl: track.audio_url,
                videoUrl: '',
                imageUrl: track.cover_url,
                title: track.title,
                prompt: track.lyrics || '',
                tags: track.genre || '',
                status: 'SUCCESS',
                duration: track.duration_sec || 0,
                createdAt: new Date(track.created_at).getTime()
              }]
            }));
            setTasks(mappedTasks);
          }
        });
    }
  }, [session?.user?.id]);

  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);`;

code = code.replace(target2, replacement2);
fs.writeFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', code);
console.log("Done");
