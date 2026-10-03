const fs = require('fs');
const filePath = 'C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add RefreshControl to react-native imports
if (!code.includes('RefreshControl,')) {
  code = code.replace('Modal, TouchableWithoutFeedback, Share }', 'Modal, TouchableWithoutFeedback, Share, RefreshControl }');
}

// 2. Add isRefreshing state and fetchUserSongs
const stateMarker = "const [advancedTitle, setAdvancedTitle] = useState('');";
if (code.includes(stateMarker) && !code.includes('isRefreshing')) {
  const fetchLogic = `
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUserSongs = async () => {
    if (session?.user?.id && setTasks) {
      const { data, error } = await supabase.from('tracks')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_ai', true)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        const mappedTasks = data.map(track => ({
          taskId: track.id,
          title: track.title || 'Untitled',
          status: 'SUCCESS',
          createdAt: new Date(track.created_at).getTime(),
          taskType: 'GENERATE',
          tracks: [{
            id: track.id,
            title: track.title || 'Untitled',
            imageUrl: track.cover_url,
            audioUrl: track.audio_url,
            duration: track.duration_sec,
            status: 'SUCCESS'
          }]
        }));
        setTasks(mappedTasks as any);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUserSongs();
    setIsRefreshing(false);
  };
`;
  code = code.replace(stateMarker, stateMarker + fetchLogic);
}

// 3. Replace the useEffect body to call fetchUserSongs
const useEffectPattern = /useEffect\(\(\) => \{\s*if \(session\?\.user\?\.id && setTasks\) \{\s*supabase\.from\('tracks'\)[\s\S]*?\}\s*\}\s*\}, \[session\?\.user\?\.id, setTasks\]\);/;

if (useEffectPattern.test(code)) {
  code = code.replace(useEffectPattern, `useEffect(() => { fetchUserSongs(); }, [session?.user?.id, setTasks]);`);
} else {
  // Try fallback string replace
  const startUE = code.indexOf(`  useEffect(() => {\n    if (session?.user?.id && setTasks) {\n      supabase.from('tracks')`);
  if (startUE !== -1) {
    const endUE = code.indexOf(`  }, [session?.user?.id, setTasks]);`, startUE);
    if (endUE !== -1) {
      code = code.substring(0, startUE) + `  useEffect(() => { fetchUserSongs(); }, [session?.user?.id, setTasks]);\n` + code.substring(endUE + 36);
    }
  }
}

// 4. Add RefreshControl to ScrollView
const scrollViewMarker = '<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>';
if (code.includes(scrollViewMarker) && !code.includes('RefreshControl refreshing')) {
  code = code.replace(
    scrollViewMarker,
    `<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.gold} />}>`
  );
}

// 5. Fix selectedSongTask inside Modal
const modalMarker = '{/* Detailed Song Options Modal */}';
const modalStartIdx = code.indexOf(modalMarker);

if (modalStartIdx !== -1) {
  let modalSection = code.substring(modalStartIdx);
  // Add derived variables right after <Modal ...>
  const viewStart = modalSection.indexOf('<View style={{ flex: 1');
  const derivedVars = `
        {(() => {
          const selectedTrack = selectedSongTask?.tracks?.[0];
          const coverImage = selectedTrack?.imageUrl || selectedSongTask?.imageUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop';
          const songTitle = selectedTrack?.title || selectedSongTask?.title || 'Unknown Title';
          const songAudioUrl = selectedTrack?.audioUrl || selectedSongTask?.audioUrl;
          const songPrompt = selectedTrack?.prompt || selectedSongTask?.prompt || '';
          const songDuration = selectedTrack?.duration || selectedSongTask?.duration || 0;
          return (
`;
  modalSection = modalSection.replace('<View style={{ flex: 1,', derivedVars + '<View style={{ flex: 1,');

  // close the IIFE just before </Modal>
  modalSection = modalSection.replace('</View>\n        </View>\n      </Modal>', '</View>\n        </View>\n      );\n      })()}\n      </Modal>');

  // Now replace selectedSongTask usages inside the modalSection
  modalSection = modalSection.replace(/selectedSongTask\?\.imageUrl \|\| 'https:\/\/images\.unsplash\.com[^']+'/g, 'coverImage');
  modalSection = modalSection.replace(/selectedSongTask\?\.title \|\| 'Unknown Title'/g, 'songTitle');
  modalSection = modalSection.replace(/selectedSongTask\?\.duration \|\| 'Unknown'/g, "songDuration ? `${Math.floor(songDuration/60)}:${(songDuration%60).toString().padStart(2,'0')}` : 'Unknown'");
  modalSection = modalSection.replace(/selectedSongTask\?\.audioUrl/g, 'songAudioUrl');
  modalSection = modalSection.replace(/selectedSongTask\.title/g, 'songTitle');
  modalSection = modalSection.replace(/selectedSongTask\.audioUrl/g, 'songAudioUrl');
  modalSection = modalSection.replace(/selectedSongTask\?\.prompt \|\| ''/g, "songPrompt || ''");

  code = code.substring(0, modalStartIdx) + modalSection;
}

fs.writeFileSync(filePath, code);
console.log('Successfully updated ai-studio.tsx');
