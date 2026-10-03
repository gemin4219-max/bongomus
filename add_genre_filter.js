const fs = require('fs');
const filePath = 'app/(tabs)/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add selectedGenre state
if (!content.includes('const [selectedGenre, setSelectedGenre] = useState(\'All\');')) {
  content = content.replace(
    /const \[selectedRegion, setSelectedRegion\] = useState\('All'\);/,
    "const [selectedRegion, setSelectedRegion] = useState('All');\n  const [selectedGenre, setSelectedGenre] = useState('All');"
  );
}

// 2. Update loadTrending dependencies
content = content.replace(
  /useEffect\(\(\) => \{\n    loadTrending\(\);\n  \}, \[selectedRegion\]\);/g,
  "useEffect(() => {\n    loadTrending();\n  }, [selectedRegion, selectedGenre]);"
);

// 3. Update loadTrending logic
if (!content.includes('if (selectedGenre !== \'All\') {')) {
  content = content.replace(
    /if \(selectedRegion !== 'All'\) \{\n      query = query\.ilike\('profile\.location', `%\$\{selectedRegion\}%`\);\n    \}/,
    `if (selectedRegion !== 'All') {
      query = query.ilike('profile.location', \`%\${selectedRegion}%\`);
    }
    if (selectedGenre !== 'All') {
      query = query.eq('genre', selectedGenre);
    }`
  );
}

// 4. Add UI for Genre Pills
const genrePillsUI = `
            {/* Genre Filter Pills */}
            <View style={{ marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {['All', ...dbGenres.map((g: any) => g.name || g.id)].map(genre => {
                  const isActive = selectedGenre === genre;
                  return (
                    <TouchableOpacity 
                      key={genre} 
                      onPress={() => setSelectedGenre(genre)}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isActive ? COLORS.gold : 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: isActive ? COLORS.gold : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      <Text style={{ 
                        color: isActive ? '#000' : '#fff', 
                        fontWeight: isActive ? '800' : '600',
                        fontSize: 14
                      }}>
                        {genre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
`;

if (!content.includes('{/* Genre Filter Pills */}')) {
  content = content.replace(
    /<DailyShuffler>\s*(?:\{\/\*.*?\*\/\})?\s*<AiStudioBanner/m,
    `<DailyShuffler>\n${genrePillsUI}\n            {/* AI Studio CTA Banner */}\n            <AiStudioBanner`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added genre filter to index.tsx');
