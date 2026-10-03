const fs = require('fs');
let code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', 'utf8');

const crashTarget = `        const newHistory = lyricsHistoryRef.current.slice(0, lyricsHistoryIndexRef.current + 1);
        newHistory.push(response.text);
        lyricsHistoryRef.current = newHistory;
        lyricsHistoryIndexRef.current = newHistory.length - 1;
        setLyricsHistory([...newHistory]);
        setLyricsHistoryIndex(newHistory.length - 1);`;
        
const crashFix = `        const newHistory = lyricsHistory.slice(0, lyricsHistoryIndex + 1);
        newHistory.push(response.text);
        setLyricsHistory(newHistory);
        setLyricsHistoryIndex(newHistory.length - 1);`;

if(code.includes(crashTarget)){
    code = code.replace(crashTarget, crashFix);
    fs.writeFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', code);
    console.log('Fixed crash');
} else {
    console.log('Target not found');
}
