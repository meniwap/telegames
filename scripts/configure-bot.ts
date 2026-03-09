import { getEnv } from "../apps/web/lib/env";

const env = getEnv();

async function call(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`telegram_${method}_failed`);
  }

  return response.json();
}

async function main() {
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "Open the Mini App" },
      { command: "help", description: "Show launch help" }
    ]
  });

  await call("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open Mini App",
      web_app: {
        url: env.APP_URL
      }
    }
  });

  await call("setWebhook", {
    url: `${env.APP_URL}/api/bot/webhook`
  });

  process.stdout.write("Bot configured.\n");
}

void main();
