/* StPageFlip adapter — page-flip 2.0.7 (MIT). See THIRD_PARTY_STPAGEFLIP.txt.
   The existing PDF.js document remains the single source of pages and annotations. */
(() => {
  "use strict";
  const SOURCE="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";
  let loadPromise;
  function loadLibrary(){
    if(window.St?.PageFlip)return Promise.resolve(window.St.PageFlip);
    if(!loadPromise)loadPromise=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      const fail=()=>{clearTimeout(timer);script.remove();reject(Error("StPageFlip unavailable"));};
      const timer=setTimeout(fail,12000);
      script.src=SOURCE;script.async=true;script.crossOrigin="anonymous";
      script.onload=()=>{clearTimeout(timer);window.St?.PageFlip?resolve(window.St.PageFlip):fail();};
      script.onerror=fail;document.head.append(script);
    }).catch(error=>{loadPromise=null;throw error;});
    return loadPromise;
  }
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function safeExternal(value){
    try{const url=new URL(value);return ["https:","http:","mailto:","tel:"].includes(url.protocol)?url.href:null;}catch{return null;}
  }
  function create({pdf,host,locale,onPage,onInternal,onError}){
    const count=pdf.numPages;
    const en=locale==="en";
    const msg={loading:en?"Loading page…":"Cargando página…",error:en?"Page unavailable":"Página no disponible",link:en?"Open portfolio link":"Abrir enlace del portafolio",page:en?"Page":"Página"};
    const cache=new Map(),failed=new Set(),originals=new Map();
    let book=null,active=false,desired=[],rendering=false,current=1,disposed=false,ratio=1,preparing=null;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    function spreadSize(){return book?.getOrientation()==="landscape"?2:1;}
    function hasNext(){return current+(current===1?1:spreadSize())<=count;}
    function sync(page){
      current=clamp(Number(page)||1,1,count);
      if(!active)return;
      onPage(current,{next:hasNext(),previous:current>1,spread:spreadSize()});
      queue(current);
    }
    function createLeaf(page){
      const leaf=document.createElement("div");
      leaf.className="cgaMagazinePage";leaf.dataset.magazinePage=String(page);
      if(page===1||page===count)leaf.dataset.density="hard";
      const content=document.createElement("div");content.className="cgaMagazineContent";
      const image=document.createElement("img");image.className="cgaMagazineImage";image.alt=msg.page+" "+page;image.hidden=true;image.draggable=false;
      const placeholder=document.createElement("span");placeholder.className="cgaMagazinePlaceholder";placeholder.textContent=msg.loading;
      const links=document.createElement("div");links.className="cgaMagazineLinks";
      content.append(image,placeholder,links);leaf.append(content);originals.set(page,leaf);return leaf;
    }
    function leaves(page){
      const items=new Set(host.querySelectorAll('[data-magazine-page="'+page+'"]'));
      if(originals.has(page))items.add(originals.get(page));
      return items;
    }
    function paint(page){
      const entry=cache.get(page);
      for(const leaf of leaves(page)){
        const image=leaf.querySelector(".cgaMagazineImage"),placeholder=leaf.querySelector(".cgaMagazinePlaceholder"),links=leaf.querySelector(".cgaMagazineLinks"),content=leaf.querySelector(".cgaMagazineContent");
        if(!image||!links||!placeholder||!content)continue;
        if(!entry){image.removeAttribute("src");image.hidden=true;placeholder.hidden=false;placeholder.textContent=failed.has(page)?msg.error:msg.loading;links.replaceChildren();continue;}
        if(image.getAttribute("src")!==entry.url)image.src=entry.url;
        image.hidden=false;placeholder.hidden=true;
        const r=entry.ratio/ratio;
        content.style.width=(r<1?r*100:100)+"%";content.style.height=(r>1?100/r:100)+"%";
        if(links.dataset.rendered===entry.url)continue;
        links.replaceChildren();links.dataset.rendered=entry.url;
        for(const link of entry.links){
          const a=document.createElement("a");a.setAttribute("aria-label",msg.link);
          Object.assign(a.style,{left:link.x+"%",top:link.y+"%",width:link.w+"%",height:link.h+"%"});
          if(link.url){a.href=link.url;if(/^https?:/.test(link.url)){a.target="_blank";a.rel="noopener noreferrer";}}
          else{a.href="#";a.dataset.magazineDestination=String(link.page);}
          links.append(a);
        }
      }
    }
    host.addEventListener("click",event=>{
      if(!active)return;
      const a=event.target.closest?.("a[data-magazine-destination]");
      if(a){event.preventDefault();onInternal(Number(a.dataset.magazineDestination));}
    });
    async function raster(page){
      const pdfPage=await pdf.getPage(page);
      const unit=pdfPage.getViewport({scale:1});
      const scale=Math.min(2,1500/Math.max(unit.width,unit.height),Math.sqrt(2100000/(unit.width*unit.height)));
      const vp=pdfPage.getViewport({scale});
      const canvas=document.createElement("canvas");canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
      const context=canvas.getContext("2d",{alpha:false});
      if(!context)throw Error("Canvas unavailable");
      try{
        await pdfPage.render({canvasContext:context,viewport:vp}).promise;
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Page image unavailable")),"image/webp",.90));
        const annotations=await pdfPage.getAnnotations({intent:"display"}).catch(()=>[]);
        const links=[];
        for(const item of annotations){
          if(item.subtype!=="Link"||!item.rect)continue;
          const rect=unit.convertToViewportRectangle(item.rect);
          const x=Math.min(rect[0],rect[2])/unit.width*100,y=Math.min(rect[1],rect[3])/unit.height*100;
          const w=Math.abs(rect[2]-rect[0])/unit.width*100,h=Math.abs(rect[3]-rect[1])/unit.height*100;
          if(w<=0||h<=0)continue;
          const url=safeExternal(item.url);
          let destination;
          if(!url&&item.dest){
            try{const dest=typeof item.dest==="string"?await pdf.getDestination(item.dest):item.dest;
              if(dest&&dest[0]!=null){const i=typeof dest[0]==="number"?dest[0]:await pdf.getPageIndex(dest[0]);if(Number.isInteger(i)&&i>=0&&i<count)destination=i+1;}
            }catch{}
          }
          if(url||destination)links.push({x,y,w,h,url,page:destination});
        }
        return {url:URL.createObjectURL(blob),ratio:unit.width/unit.height,links};
      }finally{canvas.width=canvas.height=0;}
    }
    function trim(){
      const keep=new Set(desired);
      for(const [page,entry] of cache){
        if(cache.size<=9)break;
        if(!keep.has(page)){cache.delete(page);for(const leaf of leaves(page)){const layer=leaf.querySelector(".cgaMagazineLinks");if(layer)delete layer.dataset.rendered;}paint(page);URL.revokeObjectURL(entry.url);}
      }
    }
    async function drain(){
      if(rendering||!active||disposed)return;
      rendering=true;
      try{
        while(active&&!disposed){
          const page=desired.find(p=>!cache.has(p)&&!failed.has(p));if(!page)break;
          try{
            const entry=await raster(page);
            if(disposed){URL.revokeObjectURL(entry.url);break;}
            cache.set(page,entry);paint(page);trim();
          }catch(error){failed.add(page);paint(page);if(page===current)onError(error);}
        }
      }finally{rendering=false;}
    }
    function queue(page){
      desired=[page,page+1,page-1,page+2,page-2,page+3,page-3].filter((p,i,a)=>p>=1&&p<=count&&a.indexOf(p)===i);
      for(const p of desired)paint(p);trim();void drain();
    }
    async function open(page){
      if(disposed)throw Error("Magazine disposed");
      active=true;
      if(!book){
        if(!preparing)preparing=(async()=>{
          const PageFlip=await loadLibrary();
          const samples=await Promise.all([1,Math.min(2,count),Math.min(3,count)].map(n=>pdf.getPage(n)));
          const ratios=samples.map(p=>{const v=p.getViewport({scale:1});return v.width/v.height;}).sort((a,b)=>a-b);
          ratio=ratios[1]; // Ignore an atypical cover when selecting the book aspect ratio.
          const wide=ratio>=1.12;
          const minWidth=wide?701:340;
          const width=650,height=Math.round(width/ratio);
          const items=Array.from({length:count},(_,i)=>createLeaf(i+1));
          host.replaceChildren(...items);
          book=new PageFlip(host,{width,height,size:"stretch",minWidth,maxWidth:1200,minHeight:100,maxHeight:1600,autoSize:false,usePortrait:true,showCover:true,startPage:page-1,drawShadow:!reduced.matches,maxShadowOpacity:.42,flippingTime:reduced.matches?1:720,showPageCorners:!reduced.matches,useMouseEvents:!reduced.matches,disableFlipByClick:true,clickEventForward:true,mobileScrollSupport:true,swipeDistance:35});
          book.on("flip",e=>sync(e.data+1));
          book.on("changeOrientation",()=>{if(active&&book)queue(current);});
          book.on("changeState",()=>{if(active)for(const p of desired)paint(p);});
          const method=book.loadFromHTML||book.loadFromHtml;
          if(!method)throw Error("Unsupported StPageFlip build");
          method.call(book,items);
        })();
        try{await preparing;}catch(error){preparing=null;active=false;throw error;}
      }
      if(!active||disposed)return;
      book.update();book.turnToPage(page-1);sync(book.getCurrentPageIndex()+1);
    }
    function go(page){
      if(!active||!book)return;
      book.turnToPage(clamp(page,1,count)-1);
      sync(book.getCurrentPageIndex()+1);
    }
    function step(delta){
      if(!active||!book||!delta)return;
      if(delta>0&&!hasNext()||delta<0&&current===1)return;
      if(reduced.matches){delta>0?book.turnToNextPage():book.turnToPrevPage();return;}
      delta>0?book.flipNext("bottom"):book.flipPrev("bottom");
    }
    function close(){active=false;desired=[];}
    function resize(){if(active&&book){book.update();sync(book.getCurrentPageIndex()+1);}}
    function dispose(){disposed=true;close();for(const entry of cache.values())URL.revokeObjectURL(entry.url);cache.clear();if(book)try{book.destroy();}catch{}}
    return {open,close,go,step,resize,dispose};
  }
  window.CGAMagazine={create};
})();
