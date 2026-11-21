/** At most `limit` tasks run at once, the others wait for their turn */
export class Semaphore {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    this.running++;

    try {
      return await task();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The http status of an error of an AI sdk, they both put it in `status` */
export const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown })?.status;

  return typeof status === 'number' ? status : undefined;
};

/** Too many requests and the errors of the server can pass on a next try, the rest can not */
export const isRetryable = (error: unknown) => {
  const status = statusOf(error);

  return status === 429 || (status !== undefined && status >= 500);
};
