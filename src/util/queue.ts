export class Queue<T> {
  private storage: T[] = [];

  enqueue(data: T): void {
    this.storage.push(data);
  }

  dequeue(): T | undefined {
    return this.storage.shift();
  }

  isEmpty(): boolean {
    return this.storage.length === 0;
  }
}
