const fs = require('fs');
const filePath = 'app/player.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacement = `const handleReport = () => {
    Alert.alert(
      "Ripoti Wimbo (Report Track)",
      "Tatizo ni nini na huu wimbo? (What is the issue?)",
      [
        { text: "Ghairi (Cancel)", style: "cancel" },
        { 
          text: "Aina Sio Sahihi (Incorrect Genre)", 
          onPress: () => {
            if (!session) {
              Alert.alert("Kosa", "Tafadhali ingia ili kuripoti.");
              return;
            }
            Alert.alert(
              "Imetumwa kwa AI (Flagged for AI Review)", 
              "Asante! Tutatumia AI yetu na kura za jamii kuchunguza kama huu wimbo ni wa aina sahihi (e.g. Gospel)."
            );
          }
        },
        { 
          text: "Hakimiliki (Copyright)", 
          style: "destructive",
          onPress: async () => {
            if (!session) {
              Alert.alert("Kosa", "Ingia kwenye akaunti yako ili kutoa ripoti.");
              return;
            }
            try {
              const { error } = await supabase.from('copyright_reports').insert({
                track_id: currentTrack?.id,
                reporter_id: session.user.id,
                reason: 'Unauthorized use of copyrighted material'
              });
              if (error) throw error;
              Alert.alert("Asante", "Ripoti yako imepokelewa na itachunguzwa na usimamizi.");
            } catch (e: any) {
              Alert.alert("Kosa", e.message);
            }
          }
        }
      ]
    );
  };`;

const regex = /const handleReport = \(\) => \{[\s\S]*?\};/;
if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully replaced handleReport using regex.");
} else {
  console.log("Could not find handleReport using regex.");
}
