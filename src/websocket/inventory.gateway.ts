import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';

@WebSocketGateway({
  namespace: '/inventory',
  cors: { origin: true, credentials: true },
})
export class InventoryGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InventoryGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as { token?: string };
      const header = client.handshake.headers.authorization;
      const token =
        auth?.token ??
        (typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        },
      );

      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('event:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { eventId?: string },
  ) {
    if (!body?.eventId) {
      return { ok: false, error: 'Se requiere eventId' };
    }
    void client.join(`event:${body.eventId}`);
    return { ok: true, room: `event:${body.eventId}` };
  }

  emitTicketUpdate(payload: {
    eventId: string;
    ticketTypeId: string;
    remaining: number;
    updatedAt: string;
  }) {
    this.server.to(`event:${payload.eventId}`).emit('tickets:update', payload);
  }
}
