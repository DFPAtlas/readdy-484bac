function guardPage(records, options = {}) {
  const { page = 1, pageSize = 50 } = options.body ? JSON.parse(options.body) : options;
  const data = records.slice((page - 1) * pageSize, page * pageSize);
  return { success: true, data, totalCount: records.length, page, pageSize, count: data.length };
}
module.exports = { guardPage };
