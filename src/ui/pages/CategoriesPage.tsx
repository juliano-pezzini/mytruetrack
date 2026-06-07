import { useState, useMemo } from 'react';
import { useCategories } from '../hooks/useCategories.ts';
import { useTags } from '../hooks/useTags.ts';
import { CategoryForm } from '../components/CategoryForm.tsx';
import { TagForm } from '../components/TagForm.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Category, CreateCategoryParams, CategoryType } from '../../domain/category.ts';
import type { Tag, CreateTagParams } from '../../domain/tag.ts';

const TYPE_BADGES: Record<CategoryType, { label: string; className: string }> = {
  expense: { label: 'Expense', className: 'bg-red-100 text-red-700' },
  revenue: { label: 'Revenue', className: 'bg-green-100 text-green-700' },
};

type Tab = 'categories' | 'tags';

export function CategoriesPage() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'categories'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Categories
        </button>
        <button
          type="button"
          onClick={() => setTab('tags')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'tags'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tags
        </button>
      </div>

      {tab === 'categories' ? <CategoriesTab /> : <TagsTab />}
    </div>
  );
}

function CategoriesTab() {
  const { categories, create, update, remove } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Build parent-child tree for indentation
  const sorted = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId);
    const children = categories.filter((c) => c.parentId);
    const result: { category: Category; depth: number }[] = [];
    for (const root of roots) {
      result.push({ category: root, depth: 0 });
      for (const child of children.filter((c) => c.parentId === root.id)) {
        result.push({ category: child, depth: 1 });
      }
    }
    // Add orphans (parent deleted but child remains)
    const placed = new Set(result.map((r) => r.category.id));
    for (const c of categories) {
      if (!placed.has(c.id)) result.push({ category: c, depth: 0 });
    }
    return result;
  }, [categories]);

  function handleCreate(params: CreateCategoryParams) {
    create(params);
    setShowForm(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    try {
      remove(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + New Category
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Category</h3>
          <CategoryForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            categories={categories}
          />
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No categories yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(({ category, depth }) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  {editingId === category.id ? (
                    <td colSpan={3} className="px-4 py-3">
                      <CategoryForm
                        initial={{
                          name: category.name,
                          type: category.type,
                          parentId: category.parentId ?? '',
                          description: category.description ?? '',
                        }}
                        submitLabel="Save"
                        categories={categories.filter((c) => c.id !== category.id)}
                        onSubmit={(params) => {
                          update(category.id, {
                            name: params.name,
                            type: params.type,
                            parentId: params.parentId,
                            description: params.description,
                          });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td
                        className="px-4 py-3 text-gray-900"
                        style={{ paddingLeft: `${16 + depth * 24}px` }}
                      >
                        {depth > 0 && <span className="text-gray-400 mr-1">└</span>}
                        {category.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[category.type].className}`}
                        >
                          {TYPE_BADGES[category.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(category.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(category);
                            setDeleteError(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Category"
        message={
          deleteError ? deleteError : `Delete "${deleteTarget?.name}"? This cannot be undone.`
        }
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

function TagsTab() {
  const { tags, create, update, remove } = useTags();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  function handleCreate(params: CreateTagParams) {
    create(params);
    setShowForm(false);
  }

  function handleDelete() {
    if (deleteTarget) {
      remove(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + New Tag
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Tag</h3>
          <TagForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {tags.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No tags yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Color</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-gray-50">
                  {editingId === tag.id ? (
                    <td colSpan={3} className="px-4 py-3">
                      <TagForm
                        initial={{ name: tag.name, color: tag.color }}
                        submitLabel="Save"
                        onSubmit={(params) => {
                          update(tag.id, { name: params.name, color: params.color });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: tag.color }}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-900">{tag.name}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(tag.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tag)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Tag"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
