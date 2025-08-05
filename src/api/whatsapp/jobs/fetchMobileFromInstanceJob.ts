import Bull from "bull";
import { WhatsappRepository } from "../whatsappRepository";

const maxAttemptsPerDelay = 5;
const maxRetries = 10;
const initialDelay = 2000;

const redis_url = process.env.REDIS_URL;

const fetchMobileQueue = new Bull("fetchMobileQueue", {
  redis: redis_url,
});

export const fetchMobileFromInstanceJob = (instanceName: string) => {
  fetchMobileQueue.add(
    { instanceName, attemptCount: 1, retryCount: 1, currentDelay: initialDelay },
    { delay: initialDelay },
  );
};

fetchMobileQueue.on("error", (error) => {
  console.error("Bull queue error:", error);
});

fetchMobileQueue.process(async (job) => {
  const { instanceName, attemptCount, retryCount, currentDelay } = job.data;

  console.log(
    `Executing fetchMobileFromInstanceJob attempt ${attemptCount} for ${instanceName} (Retry #${retryCount}) with delay ${currentDelay}ms`,
  );
  
  // PERFORMANCE TESTING: Start timing the mobile fetch polling
  const pollingStartTime = Date.now();
  console.log(`..........................................................JOB POLLING START: Initiating fetchMobileFromInstance API call for ${instanceName} at ${new Date().toISOString()}`);
  console.log(`🚀 MOBILE FETCH POLLING START: Executing fetchMobileFromInstance for ${instanceName} attempt ${attemptCount}`);

  const whatsappRepository = new WhatsappRepository();
  const mobileFound = await whatsappRepository.fetchMobileFromInstance(instanceName);
  
  // PERFORMANCE TESTING: Calculate and log polling duration
  const pollingEndTime = Date.now();
  const pollingDuration = pollingEndTime - pollingStartTime;
  console.log(`..........................................................JOB POLLING COMPLETE: fetchMobileFromInstance took ${pollingDuration}ms for ${instanceName}`);
  console.log(`..........................................................MOBILE FETCH POLLING COMPLETE: fetchMobileFromInstance API call took ${pollingDuration}ms for ${instanceName}`);
  console.log(`...........................................................MOBILE FETCH POLLING STATS: Started at ${new Date(pollingStartTime).toISOString()}, ended at ${new Date(pollingEndTime).toISOString()}`);
  
  if (pollingDuration > 1000) {
    console.warn(`.........................................................SLOW MOBILE FETCH POLLING DETECTED: ${instanceName} took ${pollingDuration}ms (${(pollingDuration/1000).toFixed(2)}s)`);
  }
  
  if (mobileFound) return;

  console.log(`=========OWNER JID NOT FOUND FOR ${instanceName} : undefined==========`);
  if (retryCount < maxRetries) {
    let nextAttemptCount = attemptCount + 1;
    let nextDelay = currentDelay;
    let nextRetryCount = retryCount;

    if (nextAttemptCount > maxAttemptsPerDelay) {
      nextDelay += initialDelay;
      nextAttemptCount = 1;
      nextRetryCount++;
      console.log(
        `Max attempts reached. Increasing delay to ${nextDelay}ms for ${instanceName} (Retry #${nextRetryCount})`,
      );
    }

    fetchMobileQueue.add(
      { instanceName, attemptCount: nextAttemptCount, retryCount: nextRetryCount, currentDelay: nextDelay },
      { delay: nextDelay },
    );
  } else if (retryCount >= maxRetries) {
    console.log(`Max retries reached for ${instanceName}. Job terminated.`);
  } else {
    console.log(`Job completed successfully for ${instanceName}.`);
  }
});
