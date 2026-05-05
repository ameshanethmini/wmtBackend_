export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  ACCOUNTANT: 'accountant',
  OPERATOR: 'operator',
  EMPLOYEE: 'employee',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_HIERARCHY = Object.freeze({
  admin: 100,
  manager: 80,
  accountant: 70,
  supervisor: 60,
  operator: 40,
  employee: 20,
});
