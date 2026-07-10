export interface ODataParams {
  $filter?: string;
  $select?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  $expand?: string;
  $count?: boolean;
}

export function buildODataQuery(params: ODataParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function filterEquals(field: string, value: string | number): string {
  if (typeof value === 'string') {
    return `${field} eq '${value}'`;
  }
  return `${field} eq ${value}`;
}

export function filterContains(field: string, value: string): string {
  return `contains(${field},'${value}')`;
}

export function filterGreaterThan(field: string, value: string | number): string {
  if (typeof value === 'string') {
    return `${field} gt '${value}'`;
  }
  return `${field} gt ${value}`;
}

export function combineFilters(filters: string[], operator: 'and' | 'or' = 'and'): string {
  return filters.filter(Boolean).join(` ${operator} `);
}
