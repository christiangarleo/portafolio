/* Public portfolio files and section links are separated by language.
   Upload the *real* EN PDF to the reserved filename; do not substitute the Spanish PDF. */
(() => {
  "use strict";
  const bucket="https://gprhevdotoykofrxbufv.supabase.co/storage/v1/object/public/portafolio/";
  const config={
    es:{
      file:"Christian_Arleo_Portafolio.pdf",
      url:bucket+"Christian_Arleo_Portafolio.pdf",
      filename:"Christian_Arleo_Portafolio_ES.pdf",
      title:"Portafolio profesional de Christian Gabriel Arleo",
      // Section links verified against the published Spanish edition.
      sections:{index:3,intro:4,summary:5,projects:6,experience:23}
    },
    en:{
      // Reserved path: the English PDF has NOT been uploaded as of 2026-11-23.
      file:"Christian_Arleo_Portfolio_EN.pdf",
      url:bucket+"Christian_Arleo_Portfolio_EN.pdf",
      filename:"Christian_Arleo_Portfolio_EN.pdf",
      title:"Professional portfolio of Christian Gabriel Arleo",
      // English bookmarks/page layout need verification after PDF upload.
      sections:null
    }
  };
  window.CGAPortfolioFiles=config;
})();