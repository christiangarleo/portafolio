(() => {
  "use strict";
  const successVideoSources=Object.freeze({
    es:"https://gprhevdotoykofrxbufv.supabase.co/storage/v1/object/public/portafolio-videos/confirmacion-solicitud-es.mp4"
  });
  // Presentation only: never throw into the submission flow after CRM has accepted the lead.
  function mount({locale="es",submitted=false}={}){
    const by=id=>document.getElementById(id);
    const securityText=(es,en)=>locale==="es"?es:en;
    const layout=by("requestSuccessLayout"),video=by("requestSuccessVideo"),sound=by("requestVideoSound"),status=by("requestVideoStatus"),languageNote=by("requestVideoLanguage");
    layout.hidden=false;
    if(video.dataset.loaded==="true")return;
    video.dataset.loaded="true";
    const source=successVideoSources[locale]||successVideoSources.es;
    const videoLang=successVideoSources[locale]?locale:"es";
    video.lang=videoLang;
    video.setAttribute("aria-label",securityText("Video de agradecimiento","Thank-you video"));
    languageNote.textContent=securityText("Video en español.","Video in Spanish.");
    languageNote.hidden=videoLang===locale;
    const say=(es,en)=>{status.textContent=securityText(es,en);status.hidden=false;};
    const clear=()=>{status.hidden=true;status.textContent="";};
    const syncSound=()=>{
      sound.hidden=!!video.error||!(video.muted||video.volume===0||video.paused&&!video.ended);
      sound.textContent=video.paused&&!video.ended?securityText("Reproducir video con sonido","Play video with sound"):securityText("Activar sonido","Enable sound");
    };
    video.addEventListener("play",()=>{clear();syncSound();});
    video.addEventListener("volumechange",syncSound);
    video.addEventListener("pause",syncSound);
    video.addEventListener("ended",syncSound);
    video.addEventListener("error",()=>{
      sound.hidden=true;
      say(submitted?"No se pudo reproducir el video. Tu solicitud ya quedó registrada.":"No se pudo reproducir el video. Podés volver a intentarlo.",submitted?"The video could not be played. Your request has been recorded.":"The video could not be played. Please try again.");
    });
    sound.addEventListener("click",async()=>{
      try{video.muted=false;if(video.volume===0)video.volume=1;await video.play();clear();}
      catch{say("Usá los controles del video para reproducirlo.","Use the video controls to play it.");}
      syncSound();
    });
    video.src=source;
    // Respect reduced-motion and data-saving preferences; otherwise try audible playback first.
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||navigator.connection?.saveData){
      syncSound();return;
    }
    void (async()=>{
      try{video.muted=false;await video.play();clear();syncSound();}
      catch{
        if(video.error)return;
        try{video.muted=true;await video.play();clear();syncSound();}
        catch{if(!video.error)say("Tocá reproducir para ver el mensaje de agradecimiento.","Press play to watch the thank-you message.");syncSound();}
      }
    })();
  }


  window.CGAMessageVideo=Object.freeze({mount});
})();
