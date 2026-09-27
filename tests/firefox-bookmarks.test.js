import { describe, expect, it, vi } from 'vitest';
vi.mock('../scripts/domains/quicklinks/store.js', () => ({ store: {
    getAllItems: () => [], settings: {}, CONFIG: { DEFAULT_ITEMS_PER_PAGE: 24 }
} }));
import { bookmarkImporter } from '../scripts/domains/bookmarks/importer.js';

describe('production importer with Firefox bookmark roots', () => {
    it('ignores separators, keeps nested and empty folders, deduplicates across roots', async () => {
        chrome.bookmarks = { getTree: vi.fn(async () => [{ id: 'root________', children: [
            { id: 'toolbar_____', children: [
                { type: 'bookmark', title: 'A', url: 'https://example.com/a' },
                { type: 'separator', url: 'data:' },
                { type: 'folder', title: 'Nested', children: [{ type: 'folder', title: 'Inner', children: [
                    { type: 'bookmark', title: 'B', url: 'https://example.com/b' }
                ] }] },
                { type: 'folder', title: 'Empty', children: [] }
            ] },
            { id: 'menu________', children: [{ title: 'Duplicate A', url: 'https://example.com/a' }] },
            { id: 'unfiled_____', children: [{ title: 'C', url: 'https://example.com/c' }] }
        ] }]) };
        const parsed = await bookmarkImporter.parseBookmarkTree();
        expect(parsed.stats).toMatchObject({totalBookmarks:3, duplicateCount:1, folderCount:2, looseBookmarks:2});
        expect(parsed.folders.get('Nested')).toHaveLength(1);
        expect(parsed.folders.get('Empty')).toHaveLength(0);
        const preview = bookmarkImporter.previewImport({selectedFolders:new Set(parsed.folders.keys())});
        expect(preview.totalItems).toBe(3);
        expect((await bookmarkImporter.parseBookmarkTree()).stats.totalBookmarks).toBe(3);
    });
    it('reports the 500 item limit on the actual importer', async () => {
        chrome.bookmarks = { getTree: vi.fn(async () => [{children:[{children:
            Array.from({length:501}, (_, i) => ({url:`https://example.com/${i}`, title:String(i)}))
        }]}]) };
        await bookmarkImporter.parseBookmarkTree();
        expect(bookmarkImporter.previewImport({selectedFolders:new Set()})).toMatchObject({totalItems:500,overLimit:true,truncatedCount:1});
    });
});
