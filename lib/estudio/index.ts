import { POLICIES } from "./q1";
import { PROVISIONS } from "./q2";
import { APPLICATION, RETIREMENT } from "./q3";
import { GA_LAWS, GA_LIFE } from "./q4";
import type { Question } from "./types";

export * from "./types";
export { TOPICS, EXAM_FACTS } from "./topics";
export { FLASHCARDS } from "./flashcards";

export const QUESTIONS: Question[] = [...POLICIES, ...PROVISIONS, ...APPLICATION, ...RETIREMENT, ...GA_LAWS, ...GA_LIFE];
