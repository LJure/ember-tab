// Validate the complete sync snapshot before touching any live database.
export function validateSyncSnapshot(data) {
    const entries = Object.entries(data);
    const api = globalThis.chrome?.storage?.sync;
    if (entries.length > (api?.MAX_ITEMS || 512)) throw new Error('backup_sync_quota_exceeded');
    let total = 0;
    const encoder = new TextEncoder();
    for (const [key, value] of entries) {
        const size = encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;
        if (size > (api?.QUOTA_BYTES_PER_ITEM || 8192)) throw new Error('backup_sync_quota_exceeded');
        total += size;
    }
    if (total > (api?.QUOTA_BYTES || 102400)) throw new Error('backup_sync_quota_exceeded');
}
