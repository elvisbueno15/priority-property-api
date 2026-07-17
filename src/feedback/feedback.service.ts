import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';

export interface FeedbackItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  category: string;
  message: string;
  at: string;
}

const STORE_PATH = path.join(DATA_DIR, 'feedback.json');
const CATEGORIES = ['problem', 'suggestion', 'question', 'other'];
const MAX_ITEMS = 500;

@Injectable()
export class FeedbackService {
  private items: FeedbackItem[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
      this.items = parsed.items || [];
    } catch {
      this.items = [];
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STORE_PATH, JSON.stringify({ items: this.items }, null, 2), 'utf-8');
      } catch (e) {
        console.error('feedback store save failed', e);
      }
    }, 400);
  }

  submit(user: { id: string; name: string; email: string }, category: string, message: string): FeedbackItem {
    const text = (message || '').trim();
    if (!text) throw new BadRequestException('empty_message');
    const item: FeedbackItem = {
      id: nanoid(10),
      userId: user.id,
      name: user.name,
      email: user.email,
      category: CATEGORIES.includes(category) ? category : 'other',
      message: text.slice(0, 4000),
      at: new Date().toISOString(),
    };
    this.items.push(item);
    this.items = this.items.slice(-MAX_ITEMS);
    this.scheduleSave();
    return item;
  }

  list(): FeedbackItem[] {
    return [...this.items].reverse();
  }

  remove(id: string) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length === before) throw new NotFoundException('feedback_not_found');
    this.scheduleSave();
    return { ok: true };
  }
}
