import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Role } from './entities/role.enum';
import { User } from './entities/user.entity';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';

export interface JsonUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  private readonly filePath = path.join(DATA_DIR, 'users.json');
  private users: JsonUser[] = [];
  /** Resolves once the initial file load + demo seed finished. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.users = JSON.parse(raw) as JsonUser[];
      // Existing store: never re-seed, so deleted demo accounts stay deleted.
      if (this.users.length === 0) await this.seedIfMissing();
    } catch {
      this.users = [];
      await this.save();
      await this.seedIfMissing();
    }
  }

  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  findByEmail(email: string): JsonUser | undefined {
    return this.users.find(u => u.email === email);
  }

  findById(id: string): JsonUser | undefined {
    return this.users.find(u => u.id === id);
  }

  async findAll(): Promise<JsonUser[]> {
    return this.users.slice();
  }

  async create(email: string, password: string, name: string, role = Role.EMPLOYEE): Promise<JsonUser> {
    if (this.findByEmail(email)) {
      throw new Error('Email already registered');
    }
    const user: JsonUser = {
      id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.push(user);
    await this.save();
    return user;
  }

  async promote(userId: string, role: Role): Promise<JsonUser> {
    const user = this.findById(userId);
    if (!user) throw new Error('User not found');
    user.role = role;
    user.updatedAt = new Date().toISOString();
    await this.save();
    return user;
  }

  async remove(userId: string): Promise<void> {
    this.users = this.users.filter(u => u.id !== userId);
    await this.save();
  }

  async setPassword(userId: string, newPassword: string): Promise<JsonUser> {
    const user = this.findById(userId);
    if (!user) throw new Error('User not found');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date().toISOString();
    await this.save();
    return user;
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = this.findById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  listPublic(): Array<Pick<JsonUser, 'id' | 'email' | 'name' | 'role'>> {
    return this.users.map(({ id, email, name, role }) => ({ id, email, name, role }));
  }

  async seedIfMissing(): Promise<boolean> {
    const demo = [
      ['owner@demo.com', 'owner123', 'Owner Demo', Role.OWNER],
      ['admin@demo.com', 'admin123', 'Admin Demo', Role.ADMIN],
      ['employee@demo.com', 'employee123', 'Employee Demo', Role.EMPLOYEE],
    ];
    let added = false;
    for (const [email, password, name, role] of demo) {
      if (this.findByEmail(email as string)) continue;
      await this.create(email as string, password as string, name as string, role as Role);
      added = true;
    }
    return added;
  }
}
