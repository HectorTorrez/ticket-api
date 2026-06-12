import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const ERROR_CODE_ES: Record<string, string> = {
  'Bad Request': 'Solicitud incorrecta',
  Unauthorized: 'No autorizado',
  Forbidden: 'Prohibido',
  'Not Found': 'No encontrado',
  Conflict: 'Conflicto',
  Gone: 'Expirado',
  'Too Many Requests': 'Demasiadas solicitudes',
  'Service Unavailable': 'Servicio no disponible',
  INTERNAL_ERROR: 'ERROR_INTERNO',
  HTTP_ERROR: 'ERROR_HTTP',
};

function translateErrorCode(code: string): string {
  return ERROR_CODE_ES[code] ?? code;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let code = 'ERROR_INTERNO';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        code = translateErrorCode(
          (b.error as string) ?? HttpStatus[status] ?? 'HTTP_ERROR',
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
      message = 'Error interno del servidor';
    }

    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    response.status(status).json({
      statusCode: status,
      message: normalizedMessage,
      code: translateErrorCode(code),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
