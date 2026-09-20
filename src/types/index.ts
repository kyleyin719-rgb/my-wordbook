export type WordGroup = {
  id: string;
  name: string;
  createdAt: string;
};

export interface Example {
  id: string;
  en: string;
  zh: string;
}

export type Word = {
  id: string;
  groupId: string;
  word: string;
  ipaUK: string;
  ipaUS: string;
  partOfSpeech: string;
  meaning: string;
  examples: Example[];
  note: string;
  starred: boolean;
  updatedAt: string;
  // Keep legacy fields while old practice records and backups still exist.
  english: string;
  turkish: string;
  createdAt: string;
  correctCount: number;
  wrongCount: number;
};

export type StudySession = {
  id: string;
  status: "active" | "finished";
  sourceType: "all" | "group";
  groupId?: string;
  groupName?: string;
  startedAt: string;
  finishedAt?: string;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  activeDurationSeconds: number;
  lastActiveAt?: string;
  
  questionQueue: string[];
  reinforcementQueue: string[];
  
  currentWordId?: string;
  currentDirection?: "en-tr" | "tr-en";
  currentOptions?: string[];
  selectedOptionId?: string;
  
  lastWordId?: string;
};

export type SessionAnswer = {
  id: string;
  sessionId: string;
  wordId?: string;
  english: string;
  turkish: string;
  correct: boolean;
};
