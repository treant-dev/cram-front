// Text-to-speech helper. Currently backed by the browser's built-in Web Speech
// API (free, no backend, quality depends on the user's device). To upgrade to a
// cloud voice later, swap only the body of speak() to fetch and play a cached
// audio URL — call sites and SpeakButton stay unchanged.

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (en.length === 0) return null;
  // Prefer named high-quality voices, then en-GB/en-US, then anything English.
  const isQuality = (v: SpeechSynthesisVoice) =>
    /natural|enhanced|premium|neural|google|samantha|daniel|aria|libby|sonia/i.test(v.name);
  const isGbUs = (v: SpeechSynthesisVoice) => /en-gb|en-us|en_gb|en_us/i.test(v.lang);
  return (
    en.find((v) => isQuality(v) && isGbUs(v)) ??
    en.find(isQuality) ??
    en.find(isGbUs) ??
    en[0]
  );
}

// Voices load asynchronously in some browsers; warm the cache when they arrive.
if (isSpeechSupported()) {
  const warm = () => { cachedVoice = pickEnglishVoice() ?? cachedVoice; };
  warm();
  window.speechSynthesis.onvoiceschanged = warm;
}

export function speak(text: string, lang = "en-US"): void {
  if (!isSpeechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // stop any in-flight utterance before starting a new one
  const u = new SpeechSynthesisUtterance(text);
  const voice = cachedVoice ?? pickEnglishVoice();
  if (voice) {
    cachedVoice = voice;
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = lang;
  }
  u.rate = 0.95;
  synth.speak(u);
}
