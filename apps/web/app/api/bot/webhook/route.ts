import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { callTelegramBotApi } from "@/lib/server/telegram-bot";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
};

export async function POST(request: Request) {
  const env = getEnv();
  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (message?.text?.startsWith("/start")) {
    await callTelegramBotApi("sendMessage", {
      chat_id: message.chat.id,
      text: `Launch ${env.APP_NAME} and jump straight into the live game module.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Mini App",
              web_app: {
                url: env.APP_URL
              }
            }
          ]
        ]
      }
    });
  }

  return NextResponse.json({ ok: true });
}
