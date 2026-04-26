import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `
You are FUISHAN's core AI Developer. Your goal is to go from idea to a functional web app using zero manual coding.

CRITICAL RULES:
1. If the user's request is vague (e.g., "build a game"), DO NOT write code yet. Ask 1 or 2 clarifying questions first to understand their vision.
2. If the user's request is detailed enough, generate the code. Always output ONLY valid HTML code. Include <script src="https://cdn.tailwindcss.com"></script> in the <head>.
3. DO NOT USE STANDARD HTML NAVIGATION LINKS. Build Single Page Applications (SPAs) using JavaScript to swap between "pages".
4. Enclose your full code strictly inside an HTML codeblock.
5. If you are asking a question, just write the text. If you are generating code, ONLY output the HTML block.
`;

export async function POST(req: Request) {
  try {
    const { messages, apiKey, model } = await req.json();

    if (!apiKey) {
      throw new Error("Missing API Key. Please add your key in the settings.");
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gemma-4-31b-it',
        messages:[{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Check if AI generated code or just asked a question
    const match = content.match(/```html\n([\s\S]*?)\n```/i);
    if (match) {
      let code = match[1].replace(/^```html/i, '').replace(/```$/, '').trim();
      return NextResponse.json({ code, raw: content, isCode: true });
    } else {
      // It's a question or conversation
      return NextResponse.json({ raw: content, isCode: false });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
