export async function log(message: string) {
  console.info(`${new Date().toISOString()} ${message}`);
}
