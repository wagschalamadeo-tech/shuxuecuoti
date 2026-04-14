export interface Variation {
  question: string;
  answer: string;
  steps: string[];
  explanation: string; // This is the "Thinking Guide" (思路引导)
  difficulty: '简单' | '中等' | '困难';
}

export interface WrongQuestion {
  id?: string;
  userId: string;
  originalQuestion: string;
  imageUrl?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  knowledgePoint: string;
  variations: Variation[];
  createdAt: string;
}

export interface OCRResult {
  text: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  knowledgePoint: string;
}
