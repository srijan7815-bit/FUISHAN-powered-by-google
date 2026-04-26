import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `
You are FUISHAN's core AI Developer. Your goal is to go from idea to a functional web app using zero manual coding.
You must output clean, single-file code (HTML/Tailwind/JS) that the user can instantly preview.

CRITICAL RULES:
1. Always output ONLY valid HTML code. Include <script src="https://cdn.tailwindcss.com"></script> in the <head> for styling.
2. DO NOT USE STANDARD HTML NAVIGATION LINKS (e.g., <a href="about.html">). Because this is a single-file sandbox, standard links will crash the preview.
3. If the user asks for multiple pages, you MUST build a Single Page Application (SPA). Use JavaScript and CSS (hidden/block) to swap between "pages" (div containers) when navigation menus are clicked. 
4. Design aesthetic: Modern, minimalist, clean (like Vercel or Nothing OS), utilizing neutral palettes unless specified.
5. Enclose your full code strictly inside an HTML codeblock.
6. Do not include introductory or concluding text. Respond ONLY with the HTML block.
`;

export async function POST(req: Request) {
  try {
    const { messages, apiKey, model } = await req.json();

    if (!apiKey) {
      throw new Error("Missing API Key. Please add your key in the settings.");
    }

    // Google AI Studio OpenAI-compatible endpoint
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gemma-4-31b-it',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Extract HTML out of the markdown wrapper
    const match = content.match(/```html\n([\s\S]*?)\n```/i);
    let code = match ? match[1] : content;
    code = code.replace(/^```html/i, '').replace(/```$/, '').trim();

    return NextResponse.json({ code, raw: content });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
