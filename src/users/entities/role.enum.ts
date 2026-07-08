export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
  // legacy roles kept so old accounts still validate
  CALLER = 'caller',
  VIEWER = 'viewer',
  MODERATOR = 'moderator',
}
