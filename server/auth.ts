import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { User } from './types.js';

import fs from 'fs';
import path from 'path';

interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

const SESSIONS_FILE = path.resolve(process.env.DATA_DIR || path.resolve(process.cwd(), 'data'), 'sessions.json');

function loadSessions(): Map<string, Session> {
  const map = new Map<string, Session>();
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      for (const item of data) {
        if (item.expiresAt > Date.now()) {
          map.set(item.token, item);
        }
      }
    } catch (_) {}
  }
  return map;
}

function saveSessions(map: Map<string, Session>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (_) {}
}

const sessions = loadSessions();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const session: Session = {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  saveSessions(sessions);
  return token;
}

export function removeSession(token: string): void {
  sessions.delete(token);
  saveSessions(sessions);
}

export function getUserFromToken(token: string): User | null {
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  const user = db.getUserById(session.userId);
  if (!user || user.status === 'suspended') return null;

  return user;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Also check query param ?token=... (useful for video/clip streaming tag src)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function comparePassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
