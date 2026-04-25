import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `
You are FUISHAN's core AI Developer. Your goal is to go from idea to a functional web app using zero manual coding.
You must output clean, single-file code (HTML/Tailwind/JS) that the user can instantly preview.

CRITICAL RULES:
1. Always output ONLY valid HTML code. Include <script src="https://cdn.tailwindcss.com"></script> in the <head> for styling.
2. Do not write backend code. Rely on frontend JavaScript and mock data if necessary.
3. Design aesthetic: Modern, minimalist, clean (like Vercel or Nothing OS), utilizing neutral palettes unless specified.
4. Enclose your full code strictly inside an HTML codeblock, like so:
\`\`\`html
<!DOCTYPE html>
<html>...</html>
\`\`\`
5. Do not include introductory or concluding text. Respond ONLY with the HTML block.
`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
        messages:[{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter Error: ${response.statusText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Extract HTML out of the markdown wrapper
    const match = content.match(/```html\n([\s\S]*?)\n```/);
    const code = match ? match[1] : content.replace(/```/g, ''); // Fallback just in case

    return NextResponse.json({ code, raw: content });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}