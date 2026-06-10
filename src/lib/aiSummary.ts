import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  fetch: fetch as unknown as typeof globalThis.fetch,
});

const SYSTEM_PROMPT = `You are an analyst assistant at a disinformation research lab.
Given scraped content from a social media post or web page, produce a concise briefing in Traditional Chinese (繁體中文) with:
1. 一行摘要（核心主張）
2. 主要論點或事實陳述（3條以內）
3. 可疑或值得調查之處（如有）

Keep the total output under 200 words. Be factual and neutral.`;

export async function generateSummary(
  scrapedText: string,
  url: string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `URL: ${url}\n\n內容：\n${scrapedText.slice(0, 6000)}`,
        },
      ],
    });

    const block = message.content[0];
    return block.type === 'text' ? block.text : null;
  } catch (err) {
    console.error('[aiSummary] Failed:', err);
    return null;
  }
}

export async function analyzeCommonTopics(
  issueTexts: Array<{ id: string; text: string; url: string }>
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY || issueTexts.length === 0) return null;

  const corpus = issueTexts
    .map((i) => `[${i.id}] ${i.url}\n${i.text.slice(0, 500)}`)
    .join('\n\n---\n\n')
    .slice(0, 10000);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `You are a disinformation analyst. Given a batch of scraped content, identify:
1. 跨議題共同主題或敘事（Narrative clusters）
2. 重複出現的帳號或來源
3. 值得優先調查的議題 ID

Output in Traditional Chinese. Be concise.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: corpus,
        },
      ],
    });

    const block = message.content[0];
    return block.type === 'text' ? block.text : null;
  } catch (err) {
    console.error('[aiSummary] Topic analysis failed:', err);
    return null;
  }
}
