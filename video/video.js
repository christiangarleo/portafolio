(() => {
  "use strict";
  const locale=document.documentElement.lang==="en"?"en":"es";
  const by=id=>document.getElementById(id);
  const en=locale==="en";
  by(en?"messageEN":"messageES").setAttribute("aria-current","page");
  by("successBackPortfolio").href="/portafolio/?lang="+locale;
  if(en){
    document.title="A personal message | Christian Gabriel Arleo";
    by("messageTitle").textContent="Thank you for your interest";
    by("messageIntro").textContent="I'd like to share this personal message with you.";
    by("successBackPortfolio").textContent="Explore my portfolio";
    by("successWhatsApp").textContent="Contact me on WhatsApp";
    by("successLinkedIn").textContent="Follow me on LinkedIn";
    const wa=new URL(by("successWhatsApp").href);
    wa.searchParams.set("text","Hi, Christian. I saw your portfolio and would like to contact you.");
    by("successWhatsApp").href=wa.toString();
  }else{by("successBackPortfolio").textContent="Explorar mi portafolio";}
  window.CGAMessageVideo?.mount({locale,submitted:false});
})();
