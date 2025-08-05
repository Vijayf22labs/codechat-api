import dotenv from "dotenv";
import { cleanEnv, host, num, port, str, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly("test"),
    choices: ["development", "production", "test"],
  }),
  HOST: host({ devDefault: testOnly("localhost") }),
  PORT: port({ devDefault: testOnly(3000) }),

  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(1000) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(1000) }),
  APIKEY: str({ devDefault: testOnly("zYzP7ocstxh3Sscefew4FZTCu4ehnM8v4hu") }),
  CODECHAT_API: str({
    devDefault: testOnly("https://codechat-whatsapp-codechat-api-standalone.leiusn.easypanel.host"),
  }),
  DATABASE_URL: str({
    devDefault: testOnly("postgres://postgres:password@localhost:5432/whatsapp"),
  }),
  WEBHOOK_URL: str({
    devDefault: testOnly("http://localhost:8080/whatsapp/webhook"),
  }),
  SLACK_WEBHOOK_URL: str({
    devDefault: testOnly("https://hooks.slack.com/services/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"),
  }),
  REDIS_URL: str({
    devDefault: testOnly("default"),
  }),
  ACCESS_KEY_ID: str({ devDefault: testOnly("your-aws-access-key-id") }),
  SECRET_ACCESS_KEY: str({ devDefault: testOnly("your-aws-secret-access-key") }),
  AWS_REGION: str({ devDefault: testOnly("ap-south-1") }),
  BUCKET_NAME: str({ devDefault: testOnly("whatsapp-message-scheduler") }),
  MINIO_ENDPOINT: str({ devDefault: testOnly("http://localhost:9000") }),
});
