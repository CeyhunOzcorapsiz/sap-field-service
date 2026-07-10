import { UserRole } from '@/types/auth';

const TEKNISYEN_PERMISSIONS = [
  'service:view:own',
  'service:update:own',
  'service:start-work',
  'service:end-work',
  'service:add-note',
  'service:add-photo',
  'service:add-product',
  'service:get-signature',
  'stock:view',
  'report:view:own',
];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.TEKNISYEN]: TEKNISYEN_PERMISSIONS,
  [UserRole.BOLGE_SORUMLUSU]: [
    ...TEKNISYEN_PERMISSIONS,
    'service:create',
    'service:view:region',
    'service:assign',
    'service:close',
    'report:view:region',
    'technician:view:region',
  ],
  [UserRole.YONETIM]: [
    'service:view:all',
    'service:create',
    'service:assign',
    'service:close',
    'stock:view:all',
    'report:view:all',
    'report:export',
    'dashboard:view',
    'kpi:view',
    'technician:view:all',
  ],
  [UserRole.SIPARIS_YONETIMI]: [
    'service:view:all',
    'service:approve',
    'service:reject',
    'order:manage',
    'stock:view:all',
    'report:view:all',
    'warranty:manage',
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.TEKNISYEN]: 'Teknisyen',
  [UserRole.BOLGE_SORUMLUSU]: 'Bölge Sorumlusu',
  [UserRole.YONETIM]: 'Yönetim',
  [UserRole.SIPARIS_YONETIMI]: 'Sipariş Yönetimi',
};
