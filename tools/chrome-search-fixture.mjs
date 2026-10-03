// Used only in the disposable feature-test package, never in distribution builds.
export const searchFixture = `(() => {
    const originalFetch = window.fetch.bind(window), originalOpen = window.open.bind(window);
    const originalQuery = chrome.search.query.bind(chrome.search);
    const state = window.__searchTest = {requests:[],submissions:[],aborts:0,wallpapers:[],wallpaperMode:false};
    chrome.search.query = async options => { state.submissions.push({kind:'default',...options}); };
    window.open = (url, target) => {state.submissions.push({kind:'url',url,target});return null;};
    state.restoreRouting = () => {chrome.search.query=originalQuery;window.open=originalOpen;};
    window.fetch = async (url, options={}) => {
        const parsed = new URL(url, location.href);
        if(state.wallpaperMode) {
            const api=parsed.hostname==='api.pexels.com'||parsed.hostname==='wallhaven.cc'||(parsed.hostname==='www.bing.com'&&parsed.pathname==='/HPImageArchive.aspx');
            if(api) {
                state.wallpapers.push({url:parsed.href,headers:options.headers});
                if(state.wallpaperError) return new Response('{}',{status:state.wallpaperError});
                const full='https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg';
                const data=parsed.hostname==='api.pexels.com'?{photos:[{id:54321,photographer:'Fixture',src:{original:full},width:128,height:128}]}
                    :parsed.hostname==='www.bing.com'?{images:[{url:'/fixture-image.jpg',startdate:'20261003',copyright:'Fixture'}]}
                        :parsed.pathname.includes('/w/')?{data:{id:'abc123',purity:'sfw',path:full,thumbs:{large:full},dimension_x:128,dimension_y:128}}
                            :{data:[{id:'abc123'}],meta:{total:1,per_page:24}};
                return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
            }
            if(parsed.hostname==='w.wallhaven.cc'||(parsed.hostname==='www.bing.com'&&parsed.pathname==='/fixture-image.jpg')) {
                return originalFetch(chrome.runtime.getURL('assets/icons/icon128.png'));
            }
        }
        const hosts=['api.bing.com','suggestqueries.google.com','suggestion.baidu.com','duckduckgo.com','search.brave.com','search.yahoo.com','suggest.yandex.com','ac.search.naver.com'];
        if (!hosts.includes(parsed.hostname)) return originalFetch(url,options);
        const query = ['query','q','wd','command','part'].map(key=>parsed.searchParams.get(key)).find(Boolean);
        state.requests.push({host:parsed.hostname,query,credentials:options.credentials,redirect:options.redirect});
        if(query==='timeout') return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{state.aborts++;reject(new DOMException('Aborted','AbortError'));}));
        await new Promise(resolve=>setTimeout(resolve, query==='older' ? 1000 : 20));
        if(options.signal?.aborted) state.aborts++;
        const suggestions=[query+' one',query+' two'];
        const data=parsed.hostname==='search.yahoo.com'?{r:suggestions.map(k=>({k}))}
            :parsed.hostname==='ac.search.naver.com'?{items:[suggestions.map(q=>[q])]}
                :[query,suggestions];
        return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    };
})();`;
