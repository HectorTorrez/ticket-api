import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        code = (b.error as string) ?? HttpStatus[status] ?? 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
      message = 'Internal server error';
    }

    const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;

    response.status(status).json({
      statusCode: status,
      message: normalizedMessage,
      code,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
