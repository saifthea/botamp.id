// Utilitas Math Captcha: generate soal penjumlahan dasar (1-10) dan validasi jawaban.

export interface MathCaptcha {
  a: number;
  b: number;
  answer: number;
}

/** Generate soal acak: a + b, dimana a,b ∈ [1,10] */
export function generateMathCaptcha(): MathCaptcha {
  const a = Math.floor(Math.random() * 10) + 1; // 1-10
  const b = Math.floor(Math.random() * 10) + 1; // 1-10
  return { a, b, answer: a + b };
}

/** Validasi jawaban captcha */
export function validateCaptchaAnswer(answer: number, captcha: MathCaptcha): boolean {
  return answer === captcha.answer;
}
