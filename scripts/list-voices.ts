import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient();
const [result] = await client.listVoices({ languageCode: "ru-RU" });
for (const v of result.voices ?? []) {
  console.log(v.name, v.ssmlGender);
}
