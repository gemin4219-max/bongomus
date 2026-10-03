const fs = require('fs');

let code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', 'utf8');

const target = `updateTask(newTaskId, 'SUCCESS', [{
        id: result.id || newTaskId,
        audioUrl: result.audioUrl || 'mock-uri',
        videoUrl: result.videoUrl || '',
        imageUrl: result.imageUrl || '',
        title: result.title || taskTitle,
        prompt: prompt,
        tags: stylesText || 'generated',
        status: 'SUCCESS',
        createdAt: Date.now()
      } as any]);`;

const replacement = `const trackId = result.id || newTaskId;
      const finalAudioUrl = result.audioUrl || 'mock-uri';
      const finalImageUrl = result.imageUrl || '';
      const finalTitle = result.title || taskTitle;
      
      updateTask(newTaskId, 'SUCCESS', [{
        id: trackId,
        audioUrl: finalAudioUrl,
        videoUrl: result.videoUrl || '',
        imageUrl: finalImageUrl,
        title: finalTitle,
        prompt: prompt,
        tags: stylesText || 'generated',
        status: 'SUCCESS',
        createdAt: Date.now()
      } as any]);

      if (session?.user?.id) {
        supabase.from('tracks').insert({
          id: trackId,
          user_id: session.user.id,
          title: finalTitle,
          artist_name: profile?.username || 'BongoBox Creator',
          genre: stylesText || 'AI Generated',
          cover_url: finalImageUrl,
          audio_url: finalAudioUrl,
          duration_sec: 0,
          is_ai: true,
          is_public: false,
          lyrics: lyricsText || null
        }).then(({ error }) => {
          if (error) console.error('Supabase track insert error:', error);
          else console.log('Successfully saved to Supabase tracks!');
        });
      }`;

if (code.includes(`updateTask(newTaskId, 'SUCCESS', [{`)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', code);
    console.log("Successfully added Supabase insert");
} else {
    console.log("Could not find target block");
}
