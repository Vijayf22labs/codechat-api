const cron = require("node-cron");
import { WhatsappHelper } from "@/common/utils/whatsappHelper";
import { whatsappWrapper } from "./whatsappWrapper";

const whatsappHelper = new WhatsappHelper();

const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

const isInstanceEligibleForDeletion = (instance: any): boolean => {
  const createdAt = new Date(instance.createdAt);
  return instance.ownerJid === null && createdAt >= oneDayAgo;
};

const unregisterAndDeleteInstance = async (instance: any): Promise<void> => {
  const {
    name,
    Auth: { token },
  } = instance;
  await whatsappWrapper(whatsappHelper.unRegisterWebhook(name, token));
  await whatsappWrapper(whatsappHelper.deleteInstance(name, token));
};

async function unRegisterWebhook() {
  try {
    const instances = await whatsappWrapper(whatsappHelper.fetchInstance());
    instances.forEach(
      async (instance: any) => isInstanceEligibleForDeletion(instance) && (await unregisterAndDeleteInstance(instance)),
    );
  } catch (error) {
    console.error("Error unregistering webhook:", error);
  }
}

// Schedule a cron job to run every day at 12:00 AM
const dailyTask = cron.schedule("0 0 * * *", () => {
  unRegisterWebhook();
});

// Start the cron job
export const startCronJobs = () => {
  dailyTask.start();
};
