import logger from '@/shared/logger';
import {AppError, InternalServerError} from '@/shared/errors/AppError';

/**
 * A Railway Oriented Programming (ROP) implementation to encapsulate exception handling logic,
 * avoiding repetitive try-catch blocks and improving readability and consistency.
 *
 * Usage Examples:
 *
 * 1. Throw business logic exception on failure:
 *    const result = await Try.execute(() => service.callApi())
 *                             .orElseThrow('API call failed');
 *
 * 2. Log warning and return fallback value (for non-critical failures like cache):
 *    const data = await Try.execute(() => cache.get('key'))
 *                          .orElseLogWarning('Cache miss', null);
 *
 * 3. Execute void operations:
 *    await Try.execute(() => cache.set('key', value))
 *             .orElseLogWarning('Failed to update cache');
 *
 * 4. Custom failure handling:
 *    const result = await Try.execute(() => service.call())
 *                            .onFailure((err) => metrics.recordError(err))
 *                            .orElseThrow('Service call failed');
 *
 * @param <T> the type of result returned by the wrapped operation
 */
export class Try<T> {
  private result: T | undefined;
  private failure: Error | undefined;

  private constructor(private readonly action: () => T | Promise<T>) {}

  static execute<T>(action: () => T | Promise<T>): Try<T> {
    return new Try(action);
  }

  private async executeAction(): Promise<void> {
    try {
      this.result = await this.action();
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
    }
  }

  async orElseThrow(logMessage: string, customError?: AppError): Promise<T> {
    await this.executeAction();

    if (this.failure) {
      logger.error(`${logMessage}: ${this.failure.message}`, this.failure);

      if (this.failure instanceof AppError) {
        throw this.failure;
      }

      throw customError || new InternalServerError(logMessage);
    }

    return this.result as T;
  }

  async orElseLogWarning(logMessage: string, fallbackValue?: T): Promise<T | undefined> {
    await this.executeAction();

    if (this.failure) {
      logger.warn(`${logMessage}: ${this.failure.message}`);
      return fallbackValue;
    }

    return this.result;
  }

  onFailure(handler: (error: Error) => void | Promise<void>): Try<T> {
    const originalExecute = this.executeAction.bind(this);
    this.executeAction = async () => {
      await originalExecute();
      if (this.failure) {
        await handler(this.failure);
      }
    };
    return this;
  }

  onFailureIf(
    predicate: (error: Error) => boolean,
    handler: (error: Error) => void | Promise<void>
  ): Try<T> {
    const originalExecute = this.executeAction.bind(this);
    this.executeAction = async () => {
      await originalExecute();
      if (this.failure && predicate(this.failure)) {
        await handler(this.failure);
      }
    };
    return this;
  }
}
