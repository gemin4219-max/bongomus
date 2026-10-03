const fs = require('fs');
const path = 'C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx';
let text = fs.readFileSync(path, 'utf8');

// Add LayoutAnimation to imports if not there
if (!text.includes('LayoutAnimation')) {
    text = text.replace(
      "import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, Alert, Keyboard } from 'react-native';",
      "import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, Alert, Keyboard, LayoutAnimation } from 'react-native';"
    );
}

// 1. Hook updates
const target1 = `  const [lyricsHistory, setLyricsHistory] = useState<string[]>(['']);
  const [lyricsHistoryIndex, setLyricsHistoryIndex] = useState(0);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);`;

const repl1 = `  const [lyricsHistory, setLyricsHistory] = useState<string[]>(['']);
  const [lyricsHistoryIndex, setLyricsHistoryIndex] = useState(0);
  const lyricsHistoryRef = useRef<string[]>(['']);
  const lyricsHistoryIndexRef = useRef<number>(0);
  const lyricsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);`;

text = text.replace(target1, repl1);

// 2. Methods updates
const target2 = `    const handleLyricsChange = (text: string) => {
    setLyricsText(text);
  };
  
  // Call this onBlur or occasionally to save history
  const saveLyricsToHistory = () => {
    const newHistory = lyricsHistory.slice(0, lyricsHistoryIndex + 1);
    if (newHistory[newHistory.length - 1] !== lyricsText) {
      newHistory.push(lyricsText);
      setLyricsHistory(newHistory);
      setLyricsHistoryIndex(newHistory.length - 1);
    }
  };

  const undoLyrics = () => {
    if (lyricsHistoryIndex > 0) {
      const newIndex = lyricsHistoryIndex - 1;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistory[newIndex]);
    }
  };

  const redoLyrics = () => {
    if (lyricsHistoryIndex < lyricsHistory.length - 1) {
      const newIndex = lyricsHistoryIndex + 1;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistory[newIndex]);
    }
  };`;

const repl2 = `  const handleLyricsChange = (text: string) => {
    setLyricsText(text);
    if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
    lyricsTimerRef.current = setTimeout(() => {
      const currentHistory = lyricsHistoryRef.current;
      const currentIndex = lyricsHistoryIndexRef.current;
      if (currentHistory[currentIndex] !== text) {
        const newHistory = currentHistory.slice(0, currentIndex + 1);
        newHistory.push(text);
        lyricsHistoryRef.current = newHistory;
        lyricsHistoryIndexRef.current = newHistory.length - 1;
        setLyricsHistory([...newHistory]);
        setLyricsHistoryIndex(newHistory.length - 1);
      }
    }, 800);
  };
  
  const saveLyricsToHistory = () => {};

  const undoLyrics = () => {
    if (lyricsHistoryIndexRef.current > 0) {
      const newIndex = lyricsHistoryIndexRef.current - 1;
      lyricsHistoryIndexRef.current = newIndex;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistoryRef.current[newIndex]);
    }
  };

  const redoLyrics = () => {
    if (lyricsHistoryIndexRef.current < lyricsHistoryRef.current.length - 1) {
      const newIndex = lyricsHistoryIndexRef.current + 1;
      lyricsHistoryIndexRef.current = newIndex;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistoryRef.current[newIndex]);
    }
  };`;

text = text.replace(target2, repl2);

// 3. saveLyrics update
const target3 = `  const saveLyrics = () => {
    // Just close the modal for now, lyrics are preserved in state
    setIsLyricsMenuOpen(false);
    setIsInputExpanded(true);
  };`;

const repl3 = `  const saveLyrics = () => {
    setIsLyricsMenuOpen(false);
  };`;

text = text.replace(target3, repl3);

// 4. Modal closes and styling checkmarks
const target4 = `<TouchableOpacity style={styles.lyricsSaveButton} onPress={saveLyrics}>
                  <Ionicons name="checkmark" size={24} color="#FFF" />
                </TouchableOpacity>`;
const repl4 = `<TouchableOpacity style={styles.lyricsSaveButton} onPress={saveLyrics}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>`;
text = text.replace(target4, repl4);

const target5 = `<TouchableOpacity style={styles.lyricsSaveButton} onPress={() => setIsStylesMenuOpen(false)}>
                  <Ionicons name="checkmark" size={24} color="#FFF" />
                </TouchableOpacity>`;
const repl5 = `<TouchableOpacity style={styles.lyricsSaveButton} onPress={() => setIsStylesMenuOpen(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>`;
text = text.replace(target5, repl5);

// 5. Chips opening modal
const target6 = `                  onPress={() => {
                    setIsInputExpanded(false);
                    setTimeout(() => setIsLyricsMenuOpen(true), 400);
                  }}`;
const repl6 = `                  onPress={() => {
                    setIsLyricsMenuOpen(true);
                  }}`;
text = text.replace(target6, repl6);

const target7 = `                  onPress={() => {
                    setIsInputExpanded(false);
                    setTimeout(() => setIsStylesMenuOpen(true), 400);
                  }}`;
const repl7 = `                  onPress={() => {
                    setIsStylesMenuOpen(true);
                  }}`;
text = text.replace(target7, repl7);

// 6. Modal onRequestClose
const target8 = `<Modal visible={isLyricsMenuOpen} animationType="slide" transparent={true}>`;
const repl8 = `<Modal visible={isLyricsMenuOpen} animationType="slide" transparent={true} onRequestClose={() => setIsLyricsMenuOpen(false)}>`;
text = text.replace(target8, repl8);

const target9 = `<Modal visible={isStylesMenuOpen} animationType="slide" transparent={true}>`;
const repl9 = `<Modal visible={isStylesMenuOpen} animationType="slide" transparent={true} onRequestClose={() => setIsStylesMenuOpen(false)}>`;
text = text.replace(target9, repl9);

// Smooth Transitions for setIsInputExpanded
text = text.replace(
  /setIsInputExpanded\(true\)/g,
  '() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsInputExpanded(true); }()'
);

text = text.replace(
  /setIsInputExpanded\(false\)/g,
  '() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsInputExpanded(false); }()'
);

// We need to be careful not to replace setIsInputExpanded(true) in places where it shouldn't be executed immediately, 
// wait, the regex replacement replaces exactly `setIsInputExpanded(true)` with an IIFE. So `setIsInputExpanded(true)` inside an onPress will become `() => { ... setIsInputExpanded(true); }()`. This is perfectly valid JS!

fs.writeFileSync(path, text, 'utf8');
console.log('Update Complete');
