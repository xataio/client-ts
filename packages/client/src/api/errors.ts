import { Responses } from '.';
import { isObject, isString } from '../util/lang';

// Polyfill for TypeScript < 4.6
class ErrorWithCause extends Error {
  cause?: Error;

  constructor(message?: string, options?: { cause?: Error }) {
    // @ts-ignore - Options didn't exist before 4.6
    super(message, options);
  }
}

export class FetcherError extends ErrorWithCause {
  public status: number | string;
  public errors: Responses.BulkError['errors'] | undefined;

  constructor(status: number, data?: unknown) {
    super(getMessage(data));

    this.status = status;
    this.errors = isBulkError(data) ? data.errors : undefined;

    if (data instanceof Error) {
      this.stack = data.stack;
      this.cause = (data as ErrorWithCause).cause;
    }
  }
}

export type PossibleErrors =
  | Responses.BadRequestError
  | Responses.AuthError
  | Responses.SimpleError
  | Responses.BulkError;

function isBulkError(error: any): error is Responses.BulkError {
  return isObject(error) && Array.isArray(error.errors);
}

function isErrorWithMessage(
  error: any
): error is Responses.BadRequestError | Responses.SimpleError | Responses.AuthError {
  return isObject(error) && isString(error.message);
}

function getMessage(data?: unknown): string {
  if (data instanceof Error) {
    return data.message;
  } else if (isString(data)) {
    return data;
  } else if (isErrorWithMessage(data)) {
    return data.message;
  } else if (isBulkError(data)) {
    return 'Bulk operation failed';
  } else {
    return 'Unexpected error';
  }
}
