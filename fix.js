const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/ai-studio.tsx', 'utf8');

// The replacement of literal \\n with real newlines was already done.
// But some literal \\n inside strings got broken. We can fix them.
// Let's just fix the endsWith('\\n') issue and similar issues where there is a newline right after a quote.
content = content.replace(/endsWith\('[\r\n]+'\)/g, "endsWith('\\\\n')");
content = content.replace(/kuthibitisha\.\\n/g, "kuthibitisha.");
content = content.replace(/Sasa, soma <Text style={{ color: '#FF2A75' }}>kwa sauti<\/Text>\{'[\r\n]+'\}kuthibitisha\./g, "Sasa, soma <Text style={{ color: '#FF2A75' }}>kwa sauti</Text>{'\\\\n'}kuthibitisha.");

fs.writeFileSync('app/(tabs)/ai-studio.tsx', content);
console.log('Fixed script executed.');
