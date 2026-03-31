const normalizeMasterId = (value, fallbackPrefix, index) => {
  const cleaned = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || `${fallbackPrefix}-${index + 1}`;
};

const normalizeCourseMasterAttemptOptions = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const label = String(row.label || row.name || '').trim();
    const rawEndDate = String(row.endDate || row.attemptEndDate || '').trim();
    const parsedEndDate = new Date(rawEndDate);
    if (!label) return null;
    if (!rawEndDate || !Number.isFinite(parsedEndDate.getTime())) return null;
    const endDate = parsedEndDate.toISOString();
    return {
      id: normalizeMasterId(row.id || label, 'attempt', index),
      label, endDate,
      isActive: row.isActive !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1
    };
  }).filter(Boolean);
};

const test1 = normalizeCourseMasterAttemptOptions([{ id: 'attempt-111', label: 'Attempt 1', endDate: '2026-03-31', isActive: true, sortOrder: 1 }]);
console.log('YYYY-MM-DD input:', JSON.stringify(test1));

const test2 = normalizeCourseMasterAttemptOptions([{ id: 'attempt-111', label: 'Attempt 1', endDate: '2026-03-31T00:00:00.000Z', isActive: true, sortOrder: 1 }]);
console.log('ISO date input:', JSON.stringify(test2));

const test3 = normalizeCourseMasterAttemptOptions([{ id: 'attempt-111', label: 'Attempt 1', endDate: '', isActive: true, sortOrder: 1 }]);
console.log('Empty date:', JSON.stringify(test3));
