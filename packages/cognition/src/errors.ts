export class CostCapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CostCapExceededError";
  }
}
