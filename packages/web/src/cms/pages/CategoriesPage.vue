<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CategoryNode } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import { useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Nested categories with drag-and-drop reordering.
 *
 * Dragging uses the native HTML5 drag events, and every move is also available
 * from the keyboard (the ↑ ↓ → ← buttons), so reordering is not mouse-only.
 * One `PUT /categories/order` persists the whole flattened tree.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const tree = ref<CategoryNode[]>([])
const loading = ref(true)
const saving = ref(false)
const collapsed = ref<Set<number>>(new Set())

const canCreate = computed(() => session.can('categories.create'))
const canEdit = computed(() => session.can('categories.edit'))
const canDelete = computed(() => session.can('categories.delete'))

async function load() {
  loading.value = true
  try {
    const { data } = await cms.categories.tree()
    tree.value = data.categories
  } catch (err) {
    toast.failure(err, 'Could not load the categories')
  } finally {
    loading.value = false
  }
}

void load()

interface FlatRow {
  node: CategoryNode
  depth: number
  parentId: number | null
  index: number
  siblings: CategoryNode[]
}

/** The tree flattened for rendering, honouring collapsed branches. */
const flat = computed(() => {
  const out: FlatRow[] = []
  const walk = (nodes: CategoryNode[], depth: number, parentId: number | null) => {
    nodes.forEach((node, index) => {
      out.push({ node, depth, parentId, index, siblings: nodes })
      if (!collapsed.value.has(node.id)) walk(node.children, depth + 1, node.id)
    })
  }
  walk(tree.value, 0, null)
  return out
})

const totalCount = computed(() => {
  let count = 0
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      count += 1
      walk(node.children)
    }
  }
  walk(tree.value)
  return count
})

function toggleCollapse(id: number) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

/** Flattens the current tree into the payload the API expects. */
function orderPayload(): Array<{ id: number; parent_id: number | null; position: number }> {
  const items: Array<{ id: number; parent_id: number | null; position: number }> = []
  const walk = (nodes: CategoryNode[], parentId: number | null) => {
    nodes.forEach((node, index) => {
      items.push({ id: node.id, parent_id: parentId, position: index })
      walk(node.children, node.id)
    })
  }
  walk(tree.value, null)
  return items
}

async function persistOrder() {
  saving.value = true
  try {
    const { data } = await cms.categories.reorder(orderPayload())
    tree.value = data.categories
  } catch (err) {
    toast.failure(err, 'Could not save the new order')
    await load()
  } finally {
    saving.value = false
  }
}

function siblingsOf(parentId: number | null): CategoryNode[] {
  if (parentId === null) return tree.value
  const find = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const node of nodes) {
      if (node.id === parentId) return node
      const hit = find(node.children)
      if (hit) return hit
    }
    return null
  }
  return find(tree.value)?.children ?? []
}

function move(row: FlatRow, direction: -1 | 1) {
  const siblings = siblingsOf(row.parentId)
  const target = row.index + direction
  if (target < 0 || target >= siblings.length) return
  ;[siblings[row.index], siblings[target]] = [siblings[target], siblings[row.index]]
  void persistOrder()
}

/** Indent: become a child of the previous sibling. Outdent: move up one level. */
function indent(row: FlatRow) {
  const siblings = siblingsOf(row.parentId)
  if (row.index === 0) return
  const newParent = siblings[row.index - 1]
  const [node] = siblings.splice(row.index, 1)
  newParent.children.push(node)
  collapsed.value.delete(newParent.id)
  void persistOrder()
}

function outdent(row: FlatRow) {
  if (row.parentId === null) return
  const parentRow = flat.value.find((r) => r.node.id === row.parentId)
  if (!parentRow) return
  const siblings = siblingsOf(row.parentId)
  const [node] = siblings.splice(row.index, 1)
  const grandparent = siblingsOf(parentRow.parentId)
  grandparent.splice(parentRow.index + 1, 0, node)
  void persistOrder()
}

// ── Drag and drop ───────────────────────────────────────────────────────────

const dragged = ref<FlatRow | null>(null)
const dropTarget = ref<{ id: number; position: 'before' | 'inside' } | null>(null)

function isDescendant(node: CategoryNode, candidateId: number): boolean {
  return node.children.some((child) => child.id === candidateId || isDescendant(child, candidateId))
}

function onDragOver(event: DragEvent, row: FlatRow) {
  if (!dragged.value || dragged.value.node.id === row.node.id) return
  if (isDescendant(dragged.value.node, row.node.id)) return // cannot drop inside itself
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const inside = event.clientX - rect.left > 48
  dropTarget.value = { id: row.node.id, position: inside ? 'inside' : 'before' }
}

function onDrop(row: FlatRow) {
  const source = dragged.value
  const target = dropTarget.value
  dragged.value = null
  dropTarget.value = null
  if (!source || !target || source.node.id === row.node.id) return

  const sourceSiblings = siblingsOf(source.parentId)
  const [node] = sourceSiblings.splice(source.index, 1)

  if (target.position === 'inside') {
    row.node.children.push(node)
    collapsed.value.delete(row.node.id)
  } else {
    const targetSiblings = siblingsOf(row.parentId)
    const index = targetSiblings.findIndex((n) => n.id === row.node.id)
    targetSiblings.splice(index < 0 ? targetSiblings.length : index, 0, node)
  }
  void persistOrder()
}

// ── Create / edit ───────────────────────────────────────────────────────────

const modal = ref(false)
const form = reactive({
  id: null as number | null,
  name: '',
  type: 'all' as 'book' | 'article' | 'all',
  parent_id: null as number | null,
  thumbnail_key: null as string | null,
})

function open(node?: CategoryNode, parentId: number | null = null) {
  Object.assign(form, {
    id: node?.id ?? null,
    name: node?.name ?? '',
    type: node?.type ?? 'all',
    parent_id: node?.parent_id ?? parentId,
    thumbnail_key: node?.thumbnail_key ?? null,
  })
  modal.value = true
}

async function save() {
  if (!form.name.trim()) {
    toast.failure(new Error('A name is required'), 'Category not saved')
    return
  }
  saving.value = true
  try {
    const payload = { name: form.name, type: form.type, parent_id: form.parent_id, thumbnail_key: form.thumbnail_key }
    if (form.id) await cms.categories.update(form.id, payload)
    else await cms.categories.create(payload)
    modal.value = false
    await load()
    toast.success(form.id ? 'Category updated' : 'Category created')
  } catch (err) {
    toast.failure(err, 'Could not save the category')
  } finally {
    saving.value = false
  }
}

async function remove(node: CategoryNode) {
  const ok = await confirm({
    title: 'Delete this category?',
    message: node.children.length
      ? 'Move or delete its subcategories first — this will fail otherwise.'
      : `“${node.name}” will be removed. Books and articles in it become uncategorised.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.categories.remove(node.id)
    await load()
    toast.success('Category deleted')
  } catch (err) {
    toast.failure(err, 'Could not delete the category')
  }
}

/** Flat options for the "parent" select, excluding the node's own subtree. */
const parentOptions = computed(() => {
  const out: Array<{ id: number; label: string }> = []
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      if (form.id && (node.id === form.id || isDescendant(node, form.id))) continue
      out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` })
      walk(node.children, depth + 1)
    }
  }
  walk(tree.value, 0)
  return out
})
</script>

<template>
  <div>
    <PageHeader
      title="Categories"
      description="Drag a row onto another to nest it, or use the arrow buttons. Order is saved automatically."
      :count="totalCount"
    >
      <template #actions>
        <span v-if="saving" class="text-xs text-gray-500">Saving order…</span>
        <button v-if="canCreate" type="button" class="btn-primary h-9" @click="open()">New category</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-2">
      <div v-for="n in 6" :key="n" class="skeleton h-12 w-full" />
    </div>

    <div v-else-if="!flat.length" class="card p-10 text-center">
      <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">No categories yet</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Categories group books and articles on the storefront.</p>
      <button v-if="canCreate" type="button" class="btn-primary mt-4" @click="open()">New category</button>
    </div>

    <ul v-else class="space-y-1">
      <li
        v-for="row in flat"
        :key="row.node.id"
        class="card flex flex-wrap items-center gap-2 p-2.5 transition-colors"
        :class="[
          dropTarget?.id === row.node.id && dropTarget.position === 'inside' ? 'ring-2 ring-brand-500' : '',
          dropTarget?.id === row.node.id && dropTarget.position === 'before' ? 'border-t-2 border-t-brand-500' : '',
          dragged?.node.id === row.node.id ? 'opacity-40' : '',
        ]"
        :style="{ marginLeft: `${row.depth * 1.5}rem` }"
        :draggable="canEdit"
        @dragstart="dragged = row"
        @dragend="dragged = null; dropTarget = null"
        @dragover="onDragOver($event, row)"
        @dragleave="dropTarget = null"
        @drop.prevent="onDrop(row)"
      >
        <button
          v-if="row.node.children.length"
          type="button"
          class="btn-ghost h-6 w-6 p-0 text-xs"
          :aria-label="collapsed.has(row.node.id) ? 'Expand' : 'Collapse'"
          :aria-expanded="!collapsed.has(row.node.id)"
          @click="toggleCollapse(row.node.id)"
        >
          {{ collapsed.has(row.node.id) ? '▸' : '▾' }}
        </button>
        <span v-else class="w-6" aria-hidden="true" />

        <span v-if="canEdit" class="cursor-grab select-none text-gray-400" title="Drag to reorder" aria-hidden="true">⋮⋮</span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ row.node.name }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ row.node.type === 'all' ? 'Books & articles' : row.node.type }} ·
            {{ row.node.books_count }} books · {{ row.node.articles_count }} articles
          </p>
        </div>

        <div v-if="canEdit" class="flex items-center gap-0.5">
          <button type="button" class="btn-ghost h-7 w-7 p-0 text-xs" aria-label="Move up" @click="move(row, -1)">↑</button>
          <button type="button" class="btn-ghost h-7 w-7 p-0 text-xs" aria-label="Move down" @click="move(row, 1)">↓</button>
          <button type="button" class="btn-ghost h-7 w-7 p-0 text-xs" aria-label="Nest under previous" @click="indent(row)">→</button>
          <button type="button" class="btn-ghost h-7 w-7 p-0 text-xs" aria-label="Move out one level" @click="outdent(row)">←</button>
        </div>

        <div class="flex items-center gap-1">
          <button v-if="canCreate" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(undefined, row.node.id)">Add child</button>
          <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(row.node)">Edit</button>
          <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row.node)">Delete</button>
        </div>
      </li>
    </ul>

    <ModalDialog
      :open="modal"
      :title="form.id ? 'Edit category' : 'New category'"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Name" required>
          <input :id="id" v-model="form.name" type="text" class="input" maxlength="255" required />
        </FormField>

        <FormField v-slot="{ id }" label="Applies to">
          <select :id="id" v-model="form.type" class="input">
            <option value="all">Books and articles</option>
            <option value="book">Books only</option>
            <option value="article">Articles only</option>
          </select>
        </FormField>

        <FormField v-slot="{ id }" label="Parent category">
          <select :id="id" v-model.number="form.parent_id" class="input">
            <option :value="null">Top level</option>
            <option v-for="option in parentOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </FormField>

        <MediaPicker v-model="form.thumbnail_key" kind="category" label="Icon" />
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save category' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
