(() => {
  "use strict";
  const locale=document.documentElement.lang==="en"?"en":"es";
  const by=id=>document.getElementById(id);
  const en=locale==="en";
  by(en?"messageEN":"messageES").setAttribute("aria-current","page");
  if(en){
    document.title="A personal message | Christian Gabriel Arleo";
    by("messageHeaderPortfolio").textContent=" · Portfolio";
    by("messageTitle").textContent="Thank you for your interest";
    by("messageIntro").textContent="I'd like to share this personal message with you.";
    by("successWhatsApp").textContent="Contact me on WhatsApp";
    by("successLinkedIn").textContent="Follow me on LinkedIn";
    const wa=new URL(by("successWhatsApp").href);
    wa.searchParams.set("text","Hi, Christian. I saw your portfolio and would like to contact you.");
    by("successWhatsApp").href=wa.toString();
  }
  window.CGAMessageVideo?.mount({locale,submitted:false});
})();
