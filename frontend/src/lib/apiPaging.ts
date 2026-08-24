import { adminApi, productsApi } from './api';
import { fetchAllPages } from '../utils/paging';

/**
 * Every user / product, for the pickers that need the whole list.
 *
 * These call sites all used to pass `limit: 1000` and treat one response as the
 * complete list. That is a silent cap the day the list outgrows it — and the users
 * table is already halfway there — so they walk the pages instead.
 */
export async function fetchAllUsers(params: Record<string, any> = {}): Promise<any[]> {
  const { rows } = await fetchAllPages<any>(async (page, limit) => {
    const res = await adminApi.users({ ...params, page, limit });
    const body = res.data?.data ?? res.data;
    return { rows: body?.users || [], total: body?.pagination?.total || 0 };
  });
  return rows;
}

export async function fetchAllProducts(params: Record<string, any> = {}): Promise<any[]> {
  const { rows } = await fetchAllPages<any>(async (page, limit) => {
    const res = await productsApi.list({ ...params, page, limit } as any);
    const body = res.data?.data ?? res.data;
    return { rows: body?.products || [], total: body?.pagination?.total || 0 };
  });
  return rows;
}
