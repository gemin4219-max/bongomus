const fs = require('fs');
const filepath = 'app/player.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// We need to import useAIStore
if (!content.includes('import { useAIStore } from')) {
    content = content.replace(
        "import { usePlayerStore } from '../store/playerStore';",
        "import { usePlayerStore } from '../store/playerStore';\nimport { useAIStore } from '../store/aiStore';"
    );
}

// We need to import router
if (!content.includes('import { useRouter } from')) {
    content = content.replace(
        "import { View, Text",
        "import { useRouter } from 'expo-router';\nimport { View, Text"
    );
}

// Ensure router and setRemixData are available in the component
if (!content.includes('const router = useRouter();')) {
    content = content.replace(
        "export default function PlayerScreen() {",
        "export default function PlayerScreen() {\n  const router = useRouter();\n  const setRemixData = useAIStore((s) => s.setRemixData);"
    );
}

// Replace the mock Alert with the real logic
const target = "Alert.alert(\"Remixing...\", \"Your remix request has been sent.\"); setRemixPrompt('');";
const replace = "setRemixData({ audioUrl: currentTrack.url, title: currentTrack.title, prompt: remixPrompt, tags: currentTrack.genre || '' }); router.push('/(tabs)/ai-studio'); setRemixPrompt('');";

content = content.replace(target, replace);

fs.writeFileSync(filepath, content, 'utf8');
console.log('Successfully wired remix button');
