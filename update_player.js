const fs = require('fs');

const filepath = 'app/player.tsx';
let content = fs.readFileSync(filepath, 'utf8');

const importTarget = "import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder } from 'react-native';";
const importReplace = "import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder, TextInput, KeyboardAvoidingView, Platform } from 'react-native';";
content = content.replace(importTarget, importReplace);

const stateTarget = "  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);";
const stateReplace = "  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);\n  const [remixPrompt, setRemixPrompt] = useState('');";
content = content.replace(stateTarget, stateReplace);

const lyricsTargetRegex = /\{\/\* Lyrics Section \*\/\}[\s\S]*?(?=\{\/\* Up Next Section \*\/})/m;
const lyricsReplace = fs.readFileSync('lyrics_replace.txt', 'utf8');

const inputTargetRegex = /<\/BlurView>\s*<\/ScrollView>/m;
const inputReplace = fs.readFileSync('input_replace.txt', 'utf8');

content = content.replace(lyricsTargetRegex, () => lyricsReplace);
content = content.replace(inputTargetRegex, () => inputReplace);

fs.writeFileSync(filepath, content, 'utf8');
console.log("Successfully modified player.tsx");
