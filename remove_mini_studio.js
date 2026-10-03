const fs = require('fs');

const filePath = 'app/(tabs)/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetString = `            {/* TEMP: Mini Studio Link */}
            <TouchableOpacity 
              onPress={() => router.push('/studio/select-beat')} 
              style={{ backgroundColor: '#D4AF37', margin: 16, padding: 12, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Open Mini Studio (Vocals + Beats)</Text>
            </TouchableOpacity>`;

if (content.includes(targetString)) {
    content = content.replace(targetString, '');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully removed Mini Studio button.");
} else {
    console.log("Exact string not found, attempting regex replacement...");
    const regex = /\s*\{\/\*\s*TEMP:\s*Mini Studio Link\s*\*\/\}[\s\S]*?<\/TouchableOpacity>/;
    if (regex.test(content)) {
        content = content.replace(regex, '');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Successfully removed Mini Studio button using regex.");
    } else {
        console.log("Could not find the Mini Studio button in the file.");
    }
}
