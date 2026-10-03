const fs = require('fs');
let code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', 'utf8');

const crashTarget = /const newHistory = lyricsHistoryRef\.current\.slice\(0, lyricsHistoryIndexRef\.current \+ 1\);\r?\n\s*newHistory\.push\(response\.text\);\r?\n\s*lyricsHistoryRef\.current = newHistory;\r?\n\s*lyricsHistoryIndexRef\.current = newHistory\.length - 1;\r?\n\s*setLyricsHistory\(\[\.\.\.newHistory\]\);\r?\n\s*setLyricsHistoryIndex\(newHistory\.length - 1\);/g;

const crashFix = `const newHistory = lyricsHistory.slice(0, lyricsHistoryIndex + 1);
        newHistory.push(response.text);
        setLyricsHistory(newHistory);
        setLyricsHistoryIndex(newHistory.length - 1);`;

if (crashTarget.test(code)) {
    code = code.replace(crashTarget, crashFix);
    
    // Auto-save history debounced
    const useEffectImport = /import React, \{ (.*?) \} from 'react';/;
    if (!code.includes('useEffect')) {
        code = code.replace(useEffectImport, 'import React, { $1, useEffect } from "react";');
    }
    
    // Add the useEffect for lyricsText
    const useEffectCode = `
  // Debounced history save
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLyricsHistory(prev => {
        const newHistory = prev.slice(0, lyricsHistoryIndex + 1);
        if (newHistory[newHistory.length - 1] !== lyricsText) {
          newHistory.push(lyricsText);
          setLyricsHistoryIndex(newHistory.length - 1);
          return newHistory;
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [lyricsText]);
  `;
    
    // Inject it after lyricsText state
    code = code.replace(/const \[lyricsText, setLyricsText\] = useState\(''\);\r?\n/, 'const [lyricsText, setLyricsText] = useState("");\n' + useEffectCode);
    
    // Same for styles
    const useEffectStyles = `
  useEffect(() => {
    const timeout = setTimeout(() => {
      setStylesHistory(prev => {
        const newHistory = prev.slice(0, stylesHistoryIndex + 1);
        if (newHistory[newHistory.length - 1] !== stylesText) {
          newHistory.push(stylesText);
          setStylesHistoryIndex(newHistory.length - 1);
          return newHistory;
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [stylesText]);
  `;
    
    code = code.replace(/const \[stylesText, setStylesText\] = useState\(''\);\r?\n/, 'const [stylesText, setStylesText] = useState("");\n' + useEffectStyles);

    fs.writeFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', code);
    console.log('Fixed crash and added auto-save history');
} else {
    console.log('Target not found');
}
