import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

function cleanText(text: string): string {
  return text
    .replace(/http\S+|www\S+/g, " ")
    .replace(/@\S+/g, " ")
    .replace(/#(\S+)/g, "$1")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "No resume text provided" },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    const cleaned = cleanText(text);

    const prompt = `You are an expert resume parser and career advisor. Analyze the following resume text and extract structured information.

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):
{
  "candidate": {
    "name": "Full name or 'Not detected'",
    "email": "Email or null",
    "phone": "Phone number or null",
    "location": "City/Country or null",
    "linkedin": "LinkedIn URL or null",
    "summary": "A 2-3 sentence professional summary of this candidate"
  },
  "education": [
    {
      "degree": "Degree name",
      "field": "Field of study",
      "institution": "School name",
      "year": "Graduation year or date range"
    }
  ],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "dates": "Employment dates",
      "highlights": ["Key achievement 1", "Key achievement 2"]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"]
  },
  "jobCategory": "The most fitting job category (e.g. Software Engineering, Data Science, Marketing, Finance, Healthcare, etc.)",
  "recommendations": [
    {
      "title": "Recommended job title",
      "reason": "Brief reason why this role fits",
      "matchScore": 85
    }
  ],
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["suggestion1", "suggestion2"]
}

Resume text:
${cleaned.slice(0, 8000)}`;

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
