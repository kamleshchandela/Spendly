/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { Category, CategoryType, InsertCategory } from '../../types/category.types';
import { buildDefaultCategoryRecords } from '../seed/defaultCategories';
import { generateId } from '../../utils/idUtils';
import { nowISO } from '../../utils/dateUtils';

export class CategoryRepository {
  constructor(private db: SQLiteDatabase) {}

  private mapRow(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      type: row.type as CategoryType,
      iconName: row.icon_name,
      color: row.color,
      isDefault: Boolean(row.is_default),
      sortOrder: row.sort_order,
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(type?: CategoryType, includeArchived: boolean = false): Promise<Category[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (!includeArchived) {
      conditions.push('is_archived = 0');
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM categories ${whereClause} ORDER BY sort_order ASC, name ASC`,
      params
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<Category | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async insert(data: InsertCategory): Promise<Category> {
    const id = generateId();
    const now = nowISO();
    const maxOrderRow = await this.db.getFirstAsync<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM categories WHERE type = ?',
      [data.type]
    );
    const sortOrder = (maxOrderRow?.max_order ?? -1) + 1;

    await this.db.runAsync(
      `INSERT INTO categories (id, name, type, icon_name, color, is_default, sort_order, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.type,
        data.iconName,
        data.color,
        data.isDefault ? 1 : 0,
        sortOrder,
        data.isArchived ? 1 : 0,
        now,
        now,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to insert category');
    return created;
  }

  async update(id: string, data: Partial<InsertCategory>): Promise<Category> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }
    if (data.iconName !== undefined) {
      fields.push('icon_name = ?');
      params.push(data.iconName);
    }
    if (data.color !== undefined) {
      fields.push('color = ?');
      params.push(data.color);
    }
    if (data.isDefault !== undefined) {
      fields.push('is_default = ?');
      params.push(data.isDefault ? 1 : 0);
    }
    if (data.isArchived !== undefined) {
      fields.push('is_archived = ?');
      params.push(data.isArchived ? 1 : 0);
    }

    fields.push('updated_at = ?');
    params.push(nowISO());
    params.push(id);

    await this.db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Category not found: ${id}`);
    return updated;
  }

  async archive(id: string): Promise<void> {
    await this.db.runAsync('UPDATE categories SET is_archived = 1, updated_at = ? WHERE id = ?', [
      nowISO(),
      id,
    ]);
  }

  async seedDefaults(): Promise<void> {
    const countRow = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories'
    );
    if ((countRow?.count ?? 0) > 0) return;

    const defaults = buildDefaultCategoryRecords();
    await this.db.withTransactionAsync(async () => {
      for (const cat of defaults) {
        await this.db.runAsync(
          `INSERT INTO categories (id, name, type, icon_name, color, is_default, sort_order, is_archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.type,
            cat.iconName,
            cat.color,
            cat.isDefault,
            cat.sortOrder,
            cat.isArchived,
            cat.createdAt,
            cat.updatedAt,
          ]
        );
      }
    });
  }
}
