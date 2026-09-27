import {afterEach,describe,it,expect,vi} from 'vitest';
import {BackupManager} from '../scripts/platform/backup-manager.js';
import {validateSyncSnapshot} from '../scripts/platform/backup-validation.js';
import {WebDAVClient} from '../scripts/shared/webdav-client.js';
import {fetchWithTimeout} from '../scripts/shared/net.js';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe('Firefox backup reliability',()=>{
    it('checks per-key, total and key-count quotas before writes',()=>{
        expect(()=>validateSyncSnapshot({ok:'中文'})).not.toThrow();
        expect(()=>validateSyncSnapshot({huge:'x'.repeat(8192)})).toThrow('quota');
        expect(()=>validateSyncSnapshot(Object.fromEntries(Array.from({length:513},(_,i)=>[i,0])))).toThrow('quota');
        expect(()=>validateSyncSnapshot(Object.fromEntries(Array.from({length:100},(_,i)=>[i,'x'.repeat(1100)])))).toThrow('quota');
    });
    it('falls back if OPFS is exposed but unavailable',async()=>{
        vi.stubGlobal('navigator',{storage:{getDirectory:vi.fn().mockRejectedValue(new DOMException('disabled','SecurityError'))}});
        const m=new BackupManager();vi.spyOn(m,'createBackup').mockResolvedValue(new Blob(['zip']));
        expect(await m.createBackupForUpload()).toMatchObject({usedStreaming:false,cleanup:null});
    });
    it('cleans a created OPFS file if createWritable is unsupported',async()=>{
        const removeEntry=vi.fn();const dir={getFileHandle:async()=>({}),removeEntry};
        vi.stubGlobal('navigator',{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})}});
        const m=new BackupManager();vi.spyOn(m,'createBackup').mockResolvedValue(new Blob(['zip']));
        expect((await m.createBackupForUpload()).usedStreaming).toBe(false);expect(removeEntry).toHaveBeenCalledOnce();
    });
    it('validates blob sizes and required record keys before restore',async()=>{
        const m=new BackupManager();let entry={id:'image',fullBlob:{_blobRef:'blobs/a',size:3}};
        vi.spyOn(m,'_getStagingFile').mockImplementation(async(_db,path)=>{
            if(path.startsWith('storage/'))return new Blob(['{}']);
            if(path==='idb/local-files/index.json')return new Blob([JSON.stringify([entry])]);
            if(path==='idb/assets/index.json')return new Blob(['[]']);
            if(path.endsWith('blobs/a'))return new Blob(['abc']);return null;
        });
        expect(await m._validateStagingIntegrity({})).toBe(true);
        entry.fullBlob.size=4;expect(await m._validateStagingIntegrity({})).toBe(false);
        entry={fullBlob:{_blobRef:'blobs/a',size:3}};expect(await m._validateStagingIntegrity({})).toBe(false);
    });
    it('keeps the timeout alive during response body consumption',async()=>{
        vi.useFakeTimers();
        vi.stubGlobal('fetch',vi.fn(async(_url,{signal})=>({text:()=>new Promise((_r,j)=>signal.addEventListener('abort',()=>j(new DOMException('timeout','AbortError'))))})));
        const promise=fetchWithTimeout('https://example.test',{},100,r=>r.text());
        const assertion=expect(promise).rejects.toThrow('timeout');await vi.advanceTimersByTimeAsync(101);await assertion;
    });
    it('rejects an aborted restore transaction instead of reporting request success',async()=>{
        const m=new BackupManager();const progress=vi.fn();
        vi.spyOn(m,'_getStagingFile').mockResolvedValue(new Blob(['[{"id":"image"}]']));
        const tx={objectStore:()=>({clear:vi.fn(),put:vi.fn()}),error:new Error('disk full')};
        const db={transaction:()=>tx,close:vi.fn()};
        vi.spyOn(m,'_openDatabase').mockResolvedValue(db);
        const pending=m._importIDBFromStaging('localFiles',{},'idb/local-files',progress);
        const assertion=expect(pending).rejects.toThrow('disk full');
        await vi.waitFor(()=>expect(tx.onabort).toBeTypeOf('function'));
        tx.onabort();await assertion;
        expect(progress).not.toHaveBeenCalled();expect(db.close).toHaveBeenCalledOnce();
    });
    it('parses arbitrary DAV namespace prefixes and absent resourcetype',()=>{
        const client=new WebDAVClient({baseUrl:'https://example.test',remoteDir:'测试 # 100%/files'});
        const xml='<s:multistatus xmlns:s="DAV:"><s:response><s:href>/a%20b.zip</s:href><s:propstat><s:prop><s:getcontentlength>42</s:getcontentlength></s:prop></s:propstat></s:response></s:multistatus>';
        expect(client._parseListResponse(xml)[0]).toMatchObject({filename:'a b.zip',contentLength:42});
        expect(client._encodedRemoteDir()).toBe('%E6%B5%8B%E8%AF%95%20%23%20100%25/files');
    });
    it('does not convert denied or malformed listings into an empty success',async()=>{
        const client=new WebDAVClient({baseUrl:'https://example.test'});
        vi.stubGlobal('fetch',vi.fn(async()=>({status:403})));
        await expect(client.listFiles()).rejects.toThrow('403');
        expect(()=>client._parseListResponse('<broken')).toThrow('Invalid WebDAV XML');
    });
});
