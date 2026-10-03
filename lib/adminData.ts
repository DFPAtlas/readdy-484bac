// Financial totals must not be truncated by PostgREST's default row limit.
export async function allAdminRows(query: () => any): Promise<{data: any[]; error: null}> {
  const data: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query().range(offset, offset + 499);
    if (result.error) throw result.error;
    data.push(...(result.data || []));
    if ((result.data || []).length < 500) return {data,error:null};
  }
}
