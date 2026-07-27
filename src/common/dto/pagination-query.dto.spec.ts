import { paginationSkipTake } from './pagination-query.dto';

describe('paginationSkipTake', () => {
  it('uses defaults page=1 limit=20', () => {
    expect(paginationSkipTake()).toEqual({ skip: 0, take: 20 });
  });

  it('computes skip for later pages', () => {
    expect(paginationSkipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('clamps page below 1 and limit outside 1..100', () => {
    expect(paginationSkipTake(0, 10)).toEqual({ skip: 0, take: 10 });
    expect(paginationSkipTake(1, 0)).toEqual({ skip: 0, take: 1 });
    expect(paginationSkipTake(1, 500)).toEqual({ skip: 0, take: 100 });
  });
});
