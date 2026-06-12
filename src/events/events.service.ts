import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginationSkipTake } from '../common/dto/pagination-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryAdminEventsDto } from './dto/query-admin-events.dto';
import { QueryPublishedEventsDto } from './dto/query-published-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { randomBytes } from 'crypto';

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizerId: string, dto: CreateEventDto) {
    const suffix = randomBytes(4).toString('hex');
    const baseSlug = dto.slug?.trim() || slugify(dto.title) || 'event';
    let slug = `${baseSlug}-${suffix}`;
    const endsAt = new Date(dto.endsAt);
    const startsAt = new Date(dto.startsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.event.create({
          data: {
            organizerId,
            title: dto.title,
            slug,
            description: dto.description,
            startsAt,
            endsAt,
            venue: dto.venue,
          },
        });
      } catch (e: unknown) {
        const code =
          e && typeof e === 'object' && 'code' in e
            ? String((e as { code?: string }).code)
            : '';
        if (code === 'P2002') {
          slug = `${baseSlug}-${randomBytes(4).toString('hex')}`;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('No se pudo generar un slug único');
  }

  async update(eventId: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Evento no encontrado');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }

    try {
      return await this.prisma.event.update({
        where: { id: eventId },
        data: {
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          venue: dto.venue,
        },
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : '';
      if (code === 'P2002')
        throw new ConflictException('El slug ya está en uso');
      throw e;
    }
  }

  async softDelete(eventId: string) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Evento no encontrado');

    await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date(), published: false },
    });
  }

  async publish(eventId: string, published: boolean) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Evento no encontrado');

    return this.prisma.event.update({
      where: { id: eventId },
      data: { published },
    });
  }

  async setBanner(
    eventId: string,
    bannerKey: string,
    bannerUrl: string | null,
  ) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { bannerKey, bannerUrl },
    });
  }

  async findPublishedBySlugOrId(slugOrId: string) {
    const bySlug = await this.prisma.event.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        deletedAt: null,
        published: true,
      },
      include: {
        ticketTypes: true,
      },
    });
    if (!bySlug) throw new NotFoundException('Evento no encontrado');
    return bySlug;
  }

  async listPublished(query: QueryPublishedEventsDto) {
    const { skip, take } = paginationSkipTake(query.page, query.limit);
    const publishedOnly = query.publishedOnly !== false;

    const where = {
      deletedAt: null,
      ...(publishedOnly ? { published: true } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { slug: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip,
        take,
        include: {
          ticketTypes: {
            select: {
              id: true,
              tier: true,
              name: true,
              price: true,
              quantityRemaining: true,
              saleStartsAt: true,
              saleEndsAt: true,
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  async listForAdmin(query: QueryAdminEventsDto) {
    const { skip, take } = paginationSkipTake(query.page, query.limit);

    const where = {
      deletedAt: null,
      ...(query.published !== undefined ? { published: query.published } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { slug: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip,
        take,
        include: {
          ticketTypes: {
            select: {
              id: true,
              tier: true,
              name: true,
              price: true,
              quantityRemaining: true,
              saleStartsAt: true,
              saleEndsAt: true,
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  async requireEventForAdmin(eventId: string) {
    const ev = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!ev) throw new NotFoundException('Evento no encontrado');
    return ev;
  }

  async findByIdForAdmin(eventId: string) {
    const ev = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        ticketTypes: {
          select: {
            id: true,
            tier: true,
            name: true,
            price: true,
            quantityRemaining: true,
            saleStartsAt: true,
            saleEndsAt: true,
          },
        },
      },
    });
    if (!ev) throw new NotFoundException('Evento no encontrado');
    return ev;
  }
}
