import 'express-session';

declare module 'express-session' {
  interface SessionData {
    admin?: {
      adminId: string;
      loginId: string;
      role: 'SUPER' | 'STAFF';
      name: string;
    };
  }
}
