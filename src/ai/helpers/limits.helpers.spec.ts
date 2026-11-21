import { isRetryable, Semaphore, statusOf } from '@/ai/helpers/limits.helpers';

describe('limits.helpers', () => {
  describe('Semaphore', () => {
    // a task that finishes only when the test says so
    const createTask = () => {
      let finish!: () => void;
      const promise = new Promise<void>((resolve) => (finish = resolve));

      return { promise, finish };
    };

    it('should run the tasks that fit in the limit at once', async () => {
      const semaphore = new Semaphore(2);
      const started: number[] = [];
      const tasks = [createTask(), createTask(), createTask()];

      const results = tasks.map((task, index) =>
        semaphore.run(async () => {
          started.push(index);
          await task.promise;

          return index;
        }),
      );
      await Promise.resolve();

      expect(started).toEqual([0, 1]);

      tasks.forEach((task) => task.finish());
      await expect(Promise.all(results)).resolves.toEqual([0, 1, 2]);
    });

    it('should start the next task when a running one is done', async () => {
      const semaphore = new Semaphore(1);
      const first = createTask();
      const started: string[] = [];

      const one = semaphore.run(async () => {
        started.push('one');
        await first.promise;
      });
      const two = semaphore.run(async () => {
        started.push('two');
      });
      await Promise.resolve();

      expect(started).toEqual(['one']);

      first.finish();
      await Promise.all([one, two]);

      expect(started).toEqual(['one', 'two']);
    });

    it('should free the place when a task fails', async () => {
      const semaphore = new Semaphore(1);

      await expect(
        semaphore.run(() => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom');

      await expect(semaphore.run(() => Promise.resolve('ok'))).resolves.toBe(
        'ok',
      );
    });

    it('should never run more tasks than the limit', async () => {
      const semaphore = new Semaphore(2);
      let running = 0;
      let maxRunning = 0;

      await Promise.all(
        Array.from({ length: 6 }, () =>
          semaphore.run(async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((resolve) => setTimeout(resolve, 1));
            running--;
          }),
        ),
      );

      expect(maxRunning).toBe(2);
    });
  });

  describe('statusOf', () => {
    it('should return the status of an error of an sdk', () => {
      expect(statusOf({ status: 429 })).toBe(429);
    });

    it('should return undefined when there is no numeric status', () => {
      expect(statusOf(new Error('boom'))).toBeUndefined();
      expect(statusOf({ status: '429' })).toBeUndefined();
      expect(statusOf(null)).toBeUndefined();
      expect(statusOf(undefined)).toBeUndefined();
    });
  });

  describe('isRetryable', () => {
    it.each([429, 500, 502, 503, 504])(
      'should retry the status %i',
      (status) => {
        expect(isRetryable({ status })).toBe(true);
      },
    );

    it.each([400, 401, 403, 404])(
      'should not retry the status %i',
      (status) => {
        expect(isRetryable({ status })).toBe(false);
      },
    );

    it('should not retry an error without a status', () => {
      expect(isRetryable(new Error('boom'))).toBe(false);
    });
  });
});
