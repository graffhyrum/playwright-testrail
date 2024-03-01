import {clearInterval} from 'timers';
import {RateLimiter} from 'limiter';
import {Interval} from 'limiter/src/TokenBucket';
import {Queue} from './queue';

/**
 * FunctionQueue is a queue that will run a set number of functions per interval.
 * It is used to limit the number of concurrent requests to an API, or other rate
 * limited resource.
 * @example
 * const functionQueue = new FunctionQueue(10, 'sec'); // 10 requests per second
 * functionQueue.pushToQueue([() => console.log('hello world')]);
 * functionQueue.start();
 *
 **/
export class FunctionQueue {
  private limiter: RateLimiter;
  private functionQue: Queue<Function> = new Queue();
  private intervalId: NodeJS.Timeout | undefined;
  private functionsInProgress = 0;

  constructor(requestsPerInterval: number, interval: Interval) {
    this.limiter = new RateLimiter({
      tokensPerInterval: requestsPerInterval,
      interval,
    });
  }

  get runningFunctions(): number {
    return this.functionsInProgress;
  }

  get isRunning(): boolean {
    return !this.functionQue.isEmpty() || this.runningFunctions > 0;
  }

  pushToQueue(funcArr: Function[]) {
    funcArr.forEach(func => {
      this.functionQue.enqueue(func);
    });
  }

  async start() {
    while (!this.functionQue.isEmpty()) {
      const queuedFunction = this.functionQue.dequeue();
      if (!queuedFunction) {
        continue;
      }
      this.functionsInProgress++;
      try {
        await this.limiter.removeTokens(1);
        await queuedFunction();
      } finally {
        this.functionsInProgress--;
      }
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async waitUntilQueueClear(
    timeoutDuration: number = 25 * 1000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkQueue = () => {
        if (!this.isRunning) {
          resolve();
        } else if (Date.now() - startTime >= timeoutDuration) {
          reject(
            new Error(
              `Timeout duration exceeded, queue had ${
                this.functionsInProgress
              } items left\n ${JSON.stringify(this.functionQue, null, 2)}`
            )
          );
        } else {
          console.log(
            'waiting for queue to clear, que has ',
            this.functionsInProgress,
            ' items',
            `\n${JSON.stringify(this.functionQue, null, 2)}`
          );
          setTimeout(checkQueue, 250);
        }
      };

      checkQueue();
    });
  }
}
