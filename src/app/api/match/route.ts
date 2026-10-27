import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { scoreResume, type ResumeData, type JobRequirements } from "@/lib/scorer";

function getClient() {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { resumeData, jobDescription } = await req.json();

    if (!resumeData || !jobDescription) {
      return NextResponse.json({ error: "Resume data and job description required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    const prompt = `You are a job requirements parser. Extract structured requirements from the following job description.

Return ONLY a JSON object with this exact structure (no markdown, no fences):
{
  "title": "The job title",
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "minExperienceYears": 3,
  "requiredEducation": "Bachelor's degree or equivalent",
  "requiredField": ["Computer Science", "Software Engineering"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- requiredSkills: skills explicitly stated as required or must-have
- preferredSkills: skills listed as nice-to-have, preferred, or bonus
- minExperienceYears: minimum years mentioned (0 if not specified)
- requiredEducation: degree level required (empty string if not specified)
- requiredField: fields of study mentioned (empty array if not specified)
- keywords: important domain terms, technologies, and concepts from the description

Job description:
${jobDescription.slice(0, 4000)}`;

    const completion = await getClient().chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content || "";

    let jobReqs: JobRequirements;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      jobReqs = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return NextResponse.json({ error: "Failed to parse job requirements" }, { status: 500 });
    }

    const breakdown = scoreResume(resumeData as ResumeData, jobReqs);

    return NextResponse.json({ breakdown, jobRequirements: jobReqs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
