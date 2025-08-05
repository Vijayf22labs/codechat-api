import { env } from "./envConfig";

export async function notifySlack(message: string) {
  try {
    console.log("notify to slack", "url:", env.SLACK_WEBHOOK_URL);
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        text: message,
      }),
    });
  } catch (error) {
    console.log("Failed to send error message to Slack:", error);
  }
}
