import { Request } from 'express';
import { Session, SessionData } from 'express-session';

export type AdminSessionUser = {
  adminId: string;
  loginId: string;
  role: 'SUPER' | 'STAFF';
  name: string;
};

export type AdminRequest = Request & {
  session: Session & Partial<SessionData> & {
    admin?: AdminSessionUser;
  };
};
