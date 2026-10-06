import { convertToModelMessages, isStepCount, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const lookupWeather = tool({
  description: "Look up the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { city, forecast: "Sunny", celsius: 21 };
  },
});

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const result = streamText({
    model: process.env.AI_MODEL ?? "openai/gpt-5-mini",
    system: "You are a friendly assistant. Use lookupWeather when someone asks about the weather.",
    messages: await convertToModelMessages(messages),
    tools: { lookupWeather },
    stopWhen: isStepCount(3),
  });
  return result.toUIMessageStreamResponse();
}
