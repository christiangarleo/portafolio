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
  // Portrait phones/tablets read one page; landscape and desktop retain the spread.
  function singlePage(){return matchMedia("(max-width: 1100px) and (orientation: portrait)").matches;}
  function spreadStart(page,single=false){return single?page:page<=1?1:2*Math.floor(page/2);}
  function spreadSlots(page,count,single=false){
    const p=spreadStart(page,single);return single?[p]:p===1?[null,1]:[p,p+1<=count?p+1:null];
  }
  function spreadStep(page,delta,count,single=false){
    const p=spreadStart(page,single),next=single?p+(delta>0?1:-1):delta>0?(p===1?2:p+2):(p<=2?1:p-2);
    return next>=1&&next<=count?next:p;
  }
  function layout(viewport,ratio,single=false){
    const mobileLandscape=viewport.ownerDocument?.body?.classList.contains("cgaMobileLandscape");
    const padX=mobileLandscape?4:single||viewport.clientWidth<=820?4:42,padY=4,slots=single?1:2;
    const aw=Math.max(2,viewport.clientWidth-2*padX),ah=Math.max(2,viewport.clientHeight-2*padY);
    const width=Math.max(1,Math.floor(Math.min(aw/slots,ah*ratio)));
    const height=Math.max(1,Math.floor(width/ratio));
    return {width,height,padX,padY,slots,single};
  }
  function applyViewportLayout(viewport,stage,ratio,single=false){
    const g=layout(viewport,ratio,single);
    viewport.style.overflowX="hidden";viewport.style.overflowY="hidden";
    stage.style.width=viewport.clientWidth+"px";stage.style.height=viewport.clientHeight+"px";
    stage.style.padding=g.padY+"px "+g.padX+"px";
    return g;
  }
  async function pageRatio(pdf){
    const samples=await Promise.all([1,Math.min(2,pdf.numPages),Math.min(3,pdf.numPages)].map(n=>pdf.getPage(n)));
    const ratios=samples.map(p=>{const v=p.getViewport({scale:1});return v.width/v.height;}).sort((a,b)=>a-b);
    return ratios[1];
  }
  function safeExternal(value){
    try{const url=new URL(value);return ["https:","http:","mailto:","tel:"].includes(url.protocol)?url.href:null;}catch{return null;}
  }
  function create({pdf,host,viewport,locale,onPage,onInternal,onError,onFocus=()=>{},onBusy=()=>{}}){
    const count=pdf.numPages;
    const en=locale==="en";
    const msg={loading:en?"Loading page…":"Cargando página…",error:en?"Page unavailable":"Página no disponible",link:en?"Open portfolio link":"Abrir enlace del portafolio",page:en?"Page":"Página"};
    const cache=new Map(),failed=new Set(),originals=new Map();
    let book=null,active=false,desired=[],rendering=false,current=1,disposed=false,ratio=1,preparing=null;
    let geometry=null,quality=1500,resizing=false;
    const camera=host.parentElement,stage=camera.parentElement,hint=stage.querySelector("#magazineHint");
    // Stable, non-animated reading plane. It shares the PDF raster cache and annotations,
    // but never shares StPageFlip's moving DOM, clipped leaves, shadows or hit testing.
    const readingPlane=document.createElement("div");
    readingPlane.id="magazineReadingPlane";readingPlane.hidden=true;
    camera.append(readingPlane);
    let focused=false,scale=1,tx=0,ty=0,focusPage=1,left=0,top=0,transitionTimer=0,qualityTimer=0;
    let press=null,lastTap=null,drag=null,panTap=null,suppressClickUntil=0,tapTimer=0;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    function spreadSize(){return 2;}
    function applySize(){
      const W=viewport.clientWidth,H=viewport.clientHeight,mobileLandscape=document.body.classList.contains("cgaMobileLandscape"),pad=mobileLandscape?4:W<650?8:28;
      const verticalReserve=mobileLandscape?14:38;
      const width=Math.max(1,Math.floor(Math.min(Math.max(2,W-2*pad)/2,Math.max(2,H-verticalReserve)*ratio)));
      const height=Math.max(1,Math.floor(width/ratio));
      const changed=!geometry||width!==geometry.width||height!==geometry.height;
      geometry={width,height,slots:2,single:false};
      left=(W-2*width)/2;top=(H-height)/2-(mobileLandscape?4:5);
      viewport.parentElement.style.setProperty("--cga-book-gutter",left+"px");
      viewport.style.overflowX="hidden";viewport.style.overflowY="hidden";
      Object.assign(stage.style,{width:W+"px",height:H+"px",padding:"0"});
      Object.assign(camera.style,{left:left+"px",top:top+"px",width:2*width+"px",height:height+"px"});
      Object.assign(host.style,{width:2*width+"px",height:height+"px"});
      const px=Math.max(width,height)*Math.min(window.devicePixelRatio||1,2);
      quality=Math.max(quality,1500,Math.min(2600,Math.ceil(px/300)*300));
      return changed;
    }
    function hasNext(){return spreadStep(current,1,count)!==spreadStart(current);}
    function sync(page){
      if(resizing)return;
      current=clamp(Number(page)||1,1,count);
      if(!active)return;
      if(focused&&!spreadSlots(current,count).includes(focusPage))leave(false);
      onPage(current,{next:hasNext(),previous:current>1,spread:spreadSize()});
      queue(current);
    }
    function label(){
      hint.textContent=focused?(en?"Drag to read · Double tap to return":"Arrastrá para leer · Doble toque para volver"):(en?"Double tap to read closer":"Doble toque para leer de cerca");
      stage.classList.toggle("cgaCameraFocused",focused);
      onFocus(focused);
    }
    function renderCamera(animate=false){
      clearTimeout(transitionTimer);
      camera.style.transition=animate&&!reduced.matches?"transform 320ms cubic-bezier(.22,.8,.2,1)":"none";
      camera.style.transform=focused?`translate3d(${tx}px,${ty}px,0) scale(${scale})`:"none";
      if(animate)transitionTimer=setTimeout(()=>camera.style.transition="none",350);
    }
    function bound(){
      const W=stage.clientWidth,H=stage.clientHeight,bw=2*geometry.width*scale,bh=geometry.height*scale;
      tx=bw<=W?(W-bw)/2-left:clamp(tx,W-left-bw,-left);
      ty=bh<=H?(H-bh)/2-top:clamp(ty,H-top-bh,-top);
    }
    function pageAt(x){
      const slots=spreadSlots(current,count),r=stage.getBoundingClientRect();
      const half=x-r.left-left<geometry.width?0:1;
      return slots[half]||slots[1-half]||current;
    }
    function buildReadingPlane(){
      const slots=spreadSlots(current,count);
      readingPlane.replaceChildren(...slots.map(page=>{
        if(page){const leaf=createLeaf(page,false);leaf.style.width=geometry.width+"px";leaf.style.height=geometry.height+"px";return leaf;}
        const blank=document.createElement("div");blank.className="cgaReadingBlank";return blank;
      }));
      for(const page of slots.filter(Boolean))paint(page);
    }
    function enter(page,animate=true){
      if(!active||!book||focused||!geometry)return false;
      const state=book.getState();
      if(state!=="read"&&state!=="fold_corner")return false;
      const slots=spreadSlots(current,count);
      focusPage=slots.includes(page)?page:slots.filter(Boolean)[0];
      const i=slots[0]===focusPage?0:1,w=geometry.width,h=geometry.height,sw=stage.clientWidth,sh=stage.clientHeight;
      // Exact midpoint formula approved in StPageFlip original v0.5.
      scale=(Math.max(1.25,Math.min(5.5,Math.max(sw*.96,Math.min(950,sw*1.18))/w))+(sw<=600?1.9:sw<=900?1.7:1.5))/2;
      // A hover fold can still be active at the end of a double click. Cancel it
      // before isolating the book; the reading plane always presents a flat spread.
      book.getSettings().showPageCorners=false;
      if(state==="fold_corner")book.getFlipController().showCorner({x:-10000,y:-10000});
      book.userStop({x:-10000,y:-10000},true);
      focused=true;buildReadingPlane();readingPlane.hidden=false;host.inert=true;
      tx=sw/2-left-(i+.5)*w*scale;ty=Math.max(0,(sh-h*scale)/2)-top;
      bound();renderCamera(animate);label();
      clearTimeout(qualityTimer);
      qualityTimer=setTimeout(()=>{if(active&&focused&&quality<2600){quality=2600;queue(current);}},350);
      return true;
    }
    function leave(animate=true){
      if(!focused)return false;
      clearTimeout(qualityTimer);
      focused=false;scale=1;tx=ty=0;drag=null;panTap=null;press=null;lastTap=null;
      readingPlane.hidden=true;readingPlane.replaceChildren();host.inert=false;
      if(book){book.userStop({x:-10000,y:-10000},true);book.getSettings().showPageCorners=true;}
      renderCamera(animate);label();return true;
    }
    function toggleFocus(page){return focused?leave():enter(page);}
    // Observe native gestures without canceling StPageFlip's original paper fold.
    function begin(x,y,target){
      if(target?.closest?.("a,button")){press=null;lastTap=null;return;}
      press={x,y,t:performance.now()};
    }
    function end(x,y){
      if(!press)return;
      const p=press;press=null;const now=performance.now();
      if(Math.hypot(x-p.x,y-p.y)>12||now-p.t>450){lastTap=null;return;}
      if(lastTap&&now-lastTap.t<330&&Math.hypot(x-lastTap.x,y-lastTap.y)<30){
        lastTap=null;const page=pageAt(x);
        clearTimeout(tapTimer);tapTimer=setTimeout(()=>{if(active&&!focused)enter(page);},45);
      }else lastTap={x,y,t:now};
    }
    host.addEventListener("pointerdown",e=>{if(active&&!focused&&e.pointerType==="mouse"&&e.button===0)begin(e.clientX,e.clientY,e.target);},true);
    window.addEventListener("pointerup",e=>{if(active&&!focused&&e.pointerType==="mouse")end(e.clientX,e.clientY);},true);
    host.addEventListener("touchstart",e=>{
      if(active&&!focused&&e.touches.length===1)begin(e.touches[0].clientX,e.touches[0].clientY,e.target);
      else{press=null;lastTap=null;}
    },{capture:true,passive:true});
    window.addEventListener("touchend",e=>{if(active&&!focused&&e.changedTouches.length===1)end(e.changedTouches[0].clientX,e.changedTouches[0].clientY);},{capture:true,passive:true});
    window.addEventListener("touchcancel",()=>{press=null;lastTap=null;},true);
    // Camera drag is exclusively active while focused. Keep actual PDF anchors
    // clickable on the flat reading plane; StPageFlip cannot receive its gestures.
    for(const type of ["mousedown","touchstart"]){
      stage.addEventListener(type,e=>{if(focused)e.stopPropagation();},{capture:true,passive:true});
    }
    // The library registers these on window, not just the book. Stop them at
    // capture before the library's bubble handlers, including drags beyond the stage.
    for(const type of ["mousemove","mouseup","touchmove","touchend"]){
      window.addEventListener(type,e=>{
        if(active&&focused&&(drag||stage.contains(e.target)))e.stopImmediatePropagation();
      },{capture:true,passive:true});
    }
    stage.addEventListener("dragstart",e=>{if(focused)e.preventDefault();},true);
    stage.addEventListener("pointerdown",e=>{
      if(!active||!focused||e.button!==0||drag)return;
      // If the user grabs during the easing animation, start from the actual
      // on-screen transform, not the animation's destination.
      if(camera.style.transition!=="none"){
        const matrix=new DOMMatrixReadOnly(getComputedStyle(camera).transform);
        tx=matrix.m41;ty=matrix.m42;camera.style.transition="none";
        // Keep the approved reading scale; finish the zoom before translating.
        bound();renderCamera();
      }
      const link=!!e.target.closest?.("a");
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now(),moved:false,link};
      if(!link){try{stage.setPointerCapture(e.pointerId);}catch{}}
      if(e.pointerType==="mouse"&&!link)e.preventDefault();
    },true);
    window.addEventListener("pointermove",e=>{
      if(!focused||!drag||drag.id!==e.pointerId)return;
      if(!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>8){
        drag.moved=true;try{stage.setPointerCapture(e.pointerId);}catch{}
      }
      if(drag.moved){
        tx+=e.clientX-drag.x;ty+=e.clientY-drag.y;bound();renderCamera();e.preventDefault();
      }
      drag.x=e.clientX;drag.y=e.clientY;
    },{capture:true,passive:false});
    function stopPan(e){
      if(!drag||drag.id!==e.pointerId)return;
      const d=drag;drag=null;
      if(d.moved){suppressClickUntil=performance.now()+350;panTap=null;return;}
      if(e.type==="pointerup"&&!d.link&&performance.now()-d.t<450){
        const now=performance.now();
        if(panTap&&now-panTap.t<330&&Math.hypot(e.clientX-panTap.x,e.clientY-panTap.y)<30){
          panTap=null;suppressClickUntil=now+350;leave();
        }else panTap={t:now,x:e.clientX,y:e.clientY};
      }else panTap=null;
    }
    window.addEventListener("pointerup",stopPan,true);
    window.addEventListener("pointercancel",stopPan,true);
    stage.addEventListener("lostpointercapture",stopPan,true);
    window.addEventListener("blur",()=>{if(drag){drag=null;panTap=null;suppressClickUntil=performance.now()+350;}});
    stage.addEventListener("click",e=>{if(performance.now()<suppressClickUntil&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();}},true);
    stage.addEventListener("wheel",e=>{
      if(!focused)return;
      e.preventDefault();const units=e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1;
      tx-=(e.deltaX+(e.shiftKey?e.deltaY:0))*units;ty-=(e.shiftKey?0:e.deltaY)*units;bound();renderCamera();
    },{passive:false});
    function createLeaf(page,register=true){
      const leaf=document.createElement("div");
      leaf.className="cgaMagazinePage";leaf.dataset.magazinePage=String(page);
      if(page===1||page===count)leaf.dataset.density="hard";
      const content=document.createElement("div");content.className="cgaMagazineContent";
      const image=document.createElement("img");image.className="cgaMagazineImage";image.alt=msg.page+" "+page;image.hidden=true;image.draggable=false;
      const placeholder=document.createElement("span");placeholder.className="cgaMagazinePlaceholder";placeholder.textContent=msg.loading;
      const links=document.createElement("div");links.className="cgaMagazineLinks";
      content.append(image,placeholder,links);leaf.append(content);if(register)originals.set(page,leaf);return leaf;
    }
    function leaves(page){
      const items=new Set(host.querySelectorAll('[data-magazine-page="'+page+'"]'));
      if(originals.has(page))items.add(originals.get(page));
      for(const leaf of readingPlane.querySelectorAll('[data-magazine-page="'+page+'"]'))items.add(leaf);
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
          const a=document.createElement("a");a.setAttribute("aria-label",msg.link);a.draggable=false;
          Object.assign(a.style,{left:link.x+"%",top:link.y+"%",width:link.w+"%",height:link.h+"%"});
          if(link.url){a.href=link.url;if(/^https?:/.test(link.url)){a.target="_blank";a.rel="noopener noreferrer";}}
          else{a.href="#";a.dataset.magazineDestination=String(link.page);}
          links.append(a);
        }
      }
    }
    camera.addEventListener("click",event=>{
      if(!active)return;
      const a=event.target.closest?.("a[data-magazine-destination]");
      if(a){event.preventDefault();onInternal(Number(a.dataset.magazineDestination));}
    });
    async function raster(page,target){
      const pdfPage=await pdf.getPage(page);
      const unit=pdfPage.getViewport({scale:1});
      const scale=Math.min(4.5,target/Math.max(unit.width,unit.height),Math.sqrt(4800000/(unit.width*unit.height)));
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
        return {url:URL.createObjectURL(blob),ratio:unit.width/unit.height,links,quality:target};
      }finally{canvas.width=canvas.height=0;}
    }
    function trim(){
      const keep=new Set(desired);
      for(const [page,entry] of cache){
        if(cache.size<=9)break;
        if(!keep.has(page)){cache.delete(page);for(const leaf of leaves(page)){const layer=leaf.querySelector(".cgaMagazineLinks");if(layer)delete layer.dataset.rendered;}paint(page);URL.revokeObjectURL(entry.url);}
      }
    }
    function visibleBusy(){
      onBusy(active&&!disposed&&(!book||spreadSlots(current,count).some(p=>p&&!cache.has(p)&&!failed.has(p))));
    }
    async function drain(){
      if(rendering||!active||disposed)return;
      rendering=true;
      try{
        while(active&&!disposed){
          const page=desired.find(p=>!failed.has(p)&&(!cache.has(p)||cache.get(p).quality<quality));if(!page)break;
          try{
            const target=quality,entry=await raster(page,target);
            if(disposed){URL.revokeObjectURL(entry.url);break;}
            const old=cache.get(page);cache.set(page,entry);paint(page);trim();if(old)URL.revokeObjectURL(old.url);visibleBusy();
          }catch(error){failed.add(page);paint(page);visibleBusy();if(spreadSlots(current,count).includes(page))onError(error);}
        }
      }finally{rendering=false;visibleBusy();}
    }
    function queue(page){
      desired=[page,page+1,page-1,page+2,page-2,page+3,page-3].filter((p,i,a)=>p>=1&&p<=count&&a.indexOf(p)===i);
      for(const p of desired)paint(p);trim();visibleBusy();void drain();
    }
    async function open(page){
      if(disposed)throw Error("Magazine disposed");
      active=true;onBusy(true);
      if(!book){
        if(!preparing)preparing=(async()=>{
          const PageFlip=await loadLibrary();
          ratio=await pageRatio(pdf);
          applySize();
          const width=650,height=Math.round(width/ratio);
          const items=Array.from({length:count},(_,i)=>createLeaf(i+1));
          host.replaceChildren(...items);
          book=new PageFlip(host,{width,height,size:"stretch",minWidth:1,maxWidth:10000,minHeight:1,maxHeight:10000,autoSize:false,usePortrait:false,showCover:true,startPage:page-1,drawShadow:!reduced.matches,maxShadowOpacity:.42,flippingTime:reduced.matches?1:720,showPageCorners:true,useMouseEvents:true,disableFlipByClick:true,clickEventForward:true,mobileScrollSupport:false,swipeDistance:35});
          book.on("flip",e=>sync(e.data+1));
          book.on("changeOrientation",()=>{if(active&&book)queue(current);});
          book.on("changeState",()=>{if(active)for(const p of desired)paint(p);});
          const method=book.loadFromHTML||book.loadFromHtml;
          if(!method)throw Error("Unsupported StPageFlip build");
          method.call(book,items);
        })();
        try{await preparing;}catch(error){preparing=null;active=false;onBusy(false);throw error;}
      }
      if(!active||disposed)return;
      applySize();book.update();book.turnToPage(page-1);sync(book.getCurrentPageIndex()+1);label();
    }
    function go(page){
      if(!active||!book)return;
      leave(false);book.turnToPage(clamp(page,1,count)-1);
      sync(book.getCurrentPageIndex()+1);
    }
    function step(delta){
      if(!active||!book||!delta)return;
      if(delta>0&&!hasNext()||delta<0&&current===1)return;
      leave(false);
      if(reduced.matches){delta>0?book.turnToNextPage():book.turnToPrevPage();return;}
      delta>0?book.flipNext("bottom"):book.flipPrev("bottom");
    }
    function close(){clearTimeout(tapTimer);clearTimeout(qualityTimer);leave(false);active=false;onBusy(false);desired=[];press=null;lastTap=null;drag=null;panTap=null;}
    function resize(){
      if(active&&book){
        const page=current,was=focused,p=focusPage;
        if(was)leave(false);
        resizing=true;
        try{if(applySize()){book.update();book.turnToPage(page-1);}}
        finally{resizing=false;}
        sync(book.getCurrentPageIndex()+1);
        if(was)enter(p,false);
      }
      return geometry;
    }
    function dispose(){disposed=true;close();for(const entry of cache.values())URL.revokeObjectURL(entry.url);cache.clear();if(book)try{book.destroy();}catch{}}
    return {open,close,go,step,resize,dispose,toggleFocus,leave,isFocused:()=>focused};
  }
  window.CGAMagazine={create,layout,applyViewportLayout,pageRatio,spreadStart,spreadSlots,spreadStep,singlePage};
})();
