import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import mongoose from "mongoose";
import { startQueueSceduler } from "./common/utils/schedulerQueue";

mongoose.connect(`${env.DATABASE_URL}`);
mongoose.connection.on("connected", () => {
  console.log("Successful connected to db:", env.DATABASE_URL);
});
mongoose.connection.on("error", () => {
  throw new Error(`unable to connect to database: ${env.DATABASE_URL}`);
});
const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
  startQueueSceduler();
});

const onCloseSignal = () => {
  logger.info("sigint received, shutting down");
  server.close(() => {
    logger.info("server closed");
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
