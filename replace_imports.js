const fs = require('fs');
const files = [
  'store/playerStore.ts',
  'components/ai/AudioRecorder.tsx',
  'components/ai/CustomVoiceWizard.tsx',
  'app/station/[id].tsx',
  'app/studio/record.tsx',
  'app/discover.tsx',
  'app/(tabs)/upload.tsx',
  'app/(tabs)/ai-studio.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/from 'expo-av'/g, "from '@/mock-expo-av'");
  c = c.replace(/from "expo-av"/g, "from '@/mock-expo-av'");
  fs.writeFileSync(f, c);
});
console.log('Done!');
