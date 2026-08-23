import { Prisma } from '../generated/prisma/client';
import { SortOrder } from '../common/dto/sort-query.dto';
import {
  AdminUserSortField,
  QueryAdminUsersDto,
} from './dto/query-admin-users.dto';

export function adminUsersOrderBy(
  query: Pick<QueryAdminUsersDto, 'sortBy' | 'sortOrder'>,
): Prisma.UserOrderByWithRelationInput {
  const order = query.sortOrder ?? SortOrder.desc;

  switch (query.sortBy ?? AdminUserSortField.createdAt) {
    case AdminUserSortField.email:
      return { email: order };
    case AdminUserSortField.role:
      return { role: order };
    case AdminUserSortField.status:
      return { status: order };
    case AdminUserSortField.orderCount:
      return { orders: { _count: order } };
    case AdminUserSortField.createdAt:
    default:
      return { createdAt: order };
  }
}
