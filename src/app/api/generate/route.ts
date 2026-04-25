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

    // 🚀 BYPASSING OPENROUTER ENTIRELY 
    // Hitting Google AI Studio's direct OpenAI-compatible endpoint
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        // 👇 PASTE YOUR GOOGLE AI STUDIO API KEY HERE
        'Authorization': `Bearer AIzaSyCBtWxWxIoMg0I6OM2-bU16zMo7Hc9E4Mg`, 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Specifically requesting the Gemma 4 model
        model: 'gemma-4-31b-it',
        messages:[{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Extract HTML out of the markdown wrapper
    const match = content.match(/```html\n([\s\S]*?)\n```/i);
    let code = match ? match[1] : content;
    
    // Clean up rogue markdown backticks just in case
    code = code.replace(/^```html/i, '').replace(/```$/, '').trim();

    return NextResponse.json({ code, raw: content });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
