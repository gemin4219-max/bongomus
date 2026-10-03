const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/ai-studio.tsx', 'utf8');

const targetLine = '"Ninasoma maneno haya kuthibitisha sauti yangu ili niweze kutengeneza nyimbo."';
const replacement = `{(() => {
                        const phrases = [
                          '"Ninasoma maneno haya kuthibitisha sauti yangu ili niweze kutengeneza nyimbo."',
                          '"Mimi niko hapa kurekodi sauti yangu ili niitumie baadaye."',
                          '"Sauti yangu ni ya kipekee na nataka kuitumia kwa ubunifu."',
                          '"Muziki ni maisha, na sauti hii itakuwa sehemu ya sanaa yangu."'
                        ];
                        const phrase = phrases[Math.floor((Date.now() / 10000) % phrases.length)];
                        return (
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 36, fontWeight: 'bold', lineHeight: 46, textAlign: 'center' }}>
                            {phrase}
                          </Text>
                        );
                      })()}`;

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacement);
    fs.writeFileSync('app/(tabs)/ai-studio.tsx', content, 'utf8');
    console.log('Replaced successfully');
} else {
    console.log('Target line not found exactly. Searching for Ninasoma...');
    const match = content.match(/"Ninasoma.*nyimbo\."/);
    if (match) {
        content = content.replace(match[0], replacement);
        fs.writeFileSync('app/(tabs)/ai-studio.tsx', content, 'utf8');
        console.log('Replaced successfully via regex');
    } else {
        console.log('Could not find anything matching.');
    }
}
