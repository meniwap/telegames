import { createHmac } from "node:crypto";

type DevInitDataInput = {
  botToken: string;
  authDate?: number;
  user?: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
    photo_url?: string;
  };
};

export function buildTelegramInitData({
  botToken,
  authDate = Math.floor(Date.now() / 1000),
  user = {
    id: 424242,
    username: "graphite_dev",
    first_name: "Graphite",
    last_name: "Dev",
    photo_url: "https://t.me/i/userpic/320/graphite_dev.svg"
  }
}: DevInitDataInput) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAEAAQABAAADHqxX",
    user: JSON.stringify(user)
  });

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);

  return params.toString();
}
