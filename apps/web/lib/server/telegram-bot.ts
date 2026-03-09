import { getEnv } from "../env";

export async function callTelegramBotApi<T>(method: string, body: Record<string, unknown>) {
  const env = getEnv();
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`telegram_api_${method}_failed`);
  }

  return (await response.json()) as T;
}
