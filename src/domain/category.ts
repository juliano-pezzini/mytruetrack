/**
 * Category — hierarchical transaction classification.
 *
 * Categories are typed as 'revenue' or 'expense' and support
 * parent-child relationships via parentId.
 */

export type CategoryType = 'revenue' | 'expense';

export type Category = Readonly<{
  id: string;
  parentId: string | null;
  name: string;
  type: CategoryType;
  description: string | null;
}>;

export type CreateCategoryParams = {
  id: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  description?: string | null;
};

export function createCategory(params: CreateCategoryParams): Category {
  const name = params.name.trim();
  if (name === '') {
    throw new Error('Category name is required');
  }

  return {
    id: params.id,
    parentId: params.parentId ?? null,
    name,
    type: params.type,
    description: params.description ?? null,
  };
}
