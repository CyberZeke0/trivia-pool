const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Mixed question types used when no API key is set. Note choices.length
// varies: 2 for true/false, 4 for standard/none-of-the-above questions.
const FALLBACK_QUESTIONS = [
  { question: "What planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1 },
  { question: "How many continents are there?", choices: ["5", "6", "7", "8"], correctIndex: 2 },
  { question: "What is the capital of Japan?", choices: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correctIndex: 2 },
  { question: "Which ocean is the largest?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
  { question: "Plants absorb carbon dioxide from the air.", choices: ["True", "False"], correctIndex: 0 },
  { question: "How many strings does a standard guitar have?", choices: ["4", "5", "6", "7"], correctIndex: 2 },
  { question: "The Great Wall of China is visible from space with the naked eye.", choices: ["True", "False"], correctIndex: 1 },
  { question: "In what year did the Titanic sink?", choices: ["1905", "1912", "1920", "1931"], correctIndex: 1 },
  { question: "Which of these is NOT a primary color?", choices: ["Red", "Green", "Blue", "None of the above"], correctIndex: 3 },
  { question: "The Sun revolves around the Earth.", choices: ["True", "False"], correctIndex: 1 },
];

function buildPrompt(topic, count) {
  return `Generate ${count} trivia questions about "${topic}" for a casual party game.
Difficulty: mixed (easy to medium).

Use a MIX of these three question types across the set (don't make them all the same type):
1. Standard multiple choice - exactly 4 plausible answer choices, one correct.
2. True/False - exactly 2 choices: ["True", "False"], one correct.
3. "None of the above" - exactly 4 choices where the last choice is literally
   "None of the above", used only when it is actually the correct answer
   (i.e. all three other options are plausible-looking but wrong).

Return ONLY a valid JSON array, no markdown fences, no preamble, no explanation.
Each item must have exactly this shape:
{"question": string, "choices": string[], "correctIndex": number}

Rules:
- "choices" must have length 2 (true/false) or 4 (multiple choice / none-of-the-above)
- correctIndex must be a valid index into that item's own "choices" array
- Exactly one correct answer per question
- Choices should be plausible, not jokes or obviously wrong
- Keep question text under 120 characters
- Do not repeat questions
- Roughly aim for a mix: mostly standard multiple choice, with true/false and
  none-of-the-above questions appearing occasionally, not every question`;
}

function isValidQuestion(q) {
  if (
    !q ||
    typeof q.question !== "string" ||
    q.question.trim().length === 0 ||
    !Array.isArray(q.choices)
  ) {
    return false;
  }

  const len = q.choices.length;
  if (len !== 2 && len !== 4) return false;

  const choicesValid = q.choices.every(
    (c) => typeof c === "string" && c.trim().length > 0
  );
  if (!choicesValid) return false;

  return (
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < len
  );
}

function stripFences(text) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

async function requestBatch(topic, count) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(topic, count) }],
  });
  const text = response.choices[0].message.content;
  const parsed = JSON.parse(stripFences(text));
  if (!Array.isArray(parsed)) throw new Error("AI response was not an array");
  return parsed;
}

async function generateQuestions(topic, count, maxAttempts = 3) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
    console.warn("No OPENAI_API_KEY set - using fallback test questions instead of AI generation.");
    const shuffled = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  let questions = [];
  let attempts = 0;

  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    const needed = count - questions.length;
    try {
      const batch = await requestBatch(topic, needed + 2);
      const valid = batch.filter(isValidQuestion);
      questions = questions.concat(valid).slice(0, count);
    } catch (err) {
      console.error(`AI generation attempt ${attempts} failed:`, err.message);
    }
  }

  if (questions.length < count) {
    throw new Error(
      `Only generated ${questions.length}/${count} valid questions after ${maxAttempts} attempts`
    );
  }

  return questions;
}

module.exports = { generateQuestions };