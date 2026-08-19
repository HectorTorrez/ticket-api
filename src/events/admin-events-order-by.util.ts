import { Prisma } from '../generated/prisma/client';
import {
  AdminEventSortField,
  QueryAdminEventsDto,
} from '../events/dto/query-admin-events.dto';
import { SortOrder } from '../common/dto/sort-query.dto';

export function adminEventsOrderBy(
  query: Pick<QueryAdminEventsDto, 'sortBy' | 'sortOrder'>,
): Prisma.EventOrderByWithRelationInput {
  const order = query.sortOrder ?? SortOrder.asc;
  const field = query.sortBy ?? AdminEventSortField.startsAt;

  switch (field) {
    case AdminEventSortField.title:
      return { title: order };
    case AdminEventSortField.slug:
      return { slug: order };
    case AdminEventSortField.published:
      return { published: order };
    case AdminEventSortField.createdAt:
      return { createdAt: order };
    case AdminEventSortField.startsAt:
    default:
      return { startsAt: order };
  }
}
