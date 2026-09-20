type Accent = 'en-GB' | 'en-US';
type ActiveSpeech = { utterance: SpeechSynthesisUtterance; onFinish?: () => void };

let activeSpeech: ActiveSpeech | null = null;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function stopSpeech(): void {
  if (!speechSupported()) return;
  const previous = activeSpeech;
  activeSpeech = null;
  window.speechSynthesis.cancel();
  previous?.onFinish?.();
}

function speak(text: string, accent: Accent, onFinish?: () => void): boolean {
  if (!speechSupported() || !text.trim()) return false;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = accent;
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const exactVoice = voices.find(voice => voice.lang.toLowerCase() === accent.toLowerCase());
  const englishVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('en'));
  if (exactVoice) utterance.voice = exactVoice;
  else if (englishVoice) utterance.voice = englishVoice;
  const finish = () => {
    if (activeSpeech?.utterance !== utterance) return;
    activeSpeech = null;
    onFinish?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  activeSpeech = { utterance, onFinish };
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakWord(text: string, accent: Accent, onFinish?: () => void): boolean {
  return speak(text, accent, onFinish);
}

export function speakSentence(text: string, onFinish?: () => void): boolean {
  return speak(text, 'en-US', onFinish);
}
