import { BusinessError, type Job } from "./Types";
// 初回＋再試行3回、待ち時間1/2/4分。状態はLogsへ永続保存。
export function runJob(
  job: Job,
  now: number,
  process: () => void,
): { level: "INFO" | "WARN" | "ERROR"; code: string } {
  if (job.state !== "PENDING" || job.nextAt > now)
    throw new Error("JOB_NOT_DUE");
  job.attempts++;
  try {
    process();
    job.state = "DONE";
    return { level: "INFO", code: "ORDER_RECORDED_OR_DUPLICATE" };
  } catch (error) {
    const code =
      error instanceof BusinessError
        ? error.message
        : "PROCESSING_RETRYABLE_FAILURE";
    if (error instanceof BusinessError || job.attempts >= 4) {
      job.state = "FAILED";
      return { level: "ERROR", code };
    }
    job.nextAt = now + 60000 * 2 ** (job.attempts - 1);
    return { level: "WARN", code };
  }
}
