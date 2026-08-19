import { Prisma } from '../generated/prisma/client';
import {
  AdminOrderSortField,
  QueryAdminOrdersDto,
} from '../orders/dto/query-admin-orders.dto';
import { SortOrder } from '../common/dto/sort-query.dto';

export function adminOrdersOrderBy(
  query: Pick<QueryAdminOrdersDto, 'sortBy' | 'sortOrder'>,
): Prisma.OrderOrderByWithRelationInput {
  const order = query.sortOrder ?? SortOrder.desc;

  switch (query.sortBy ?? AdminOrderSortField.createdAt) {
    case AdminOrderSortField.id:
      return { id: order };
    case AdminOrderSortField.status:
      return { status: order };
    case AdminOrderSortField.totalAmount:
      return { totalAmount: order };
    case AdminOrderSortField.userEmail:
      return { user: { email: order } };
    case AdminOrderSortField.createdAt:
    default:
      return { createdAt: order };
  }
}
