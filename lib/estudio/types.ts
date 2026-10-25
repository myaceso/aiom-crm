export type TopicId = "policies" | "provisions" | "application" | "retirement" | "gaLaws" | "gaLife";

export type Topic = {
  id: TopicId;
  /** Scored questions for this section in the official Pearson VUE outline (12-GA-01, effective Oct 22, 2024). */
  examQuestions: number;
  title: { es: string; en: string };
  outline: string[];
  summary: { es: string[]; en: string[] };
};

export type Question = {
  id: string;
  topic: TopicId;
  q: string;
  options: string[];
  answer: number;
  exp: { es: string; en: string };
};

export type Flashcard = { topic: TopicId; term: string; es: string; en: string };
