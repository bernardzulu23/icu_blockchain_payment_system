function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  const search = (query.search || '').toString().trim();
  return { page, limit, offset, search };
}

function paginatedResponse(items, total, page, limit) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

module.exports = { parsePagination, paginatedResponse };
