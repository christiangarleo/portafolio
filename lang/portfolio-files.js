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
      // Spanish section destinations supplied by owner 2026-11-25 (Lima); summary remains pending confirmation.
      sections:{index:4,intro:6,summary:5,projects:10,experience:44}
    },
    en:{
      // Archivo EN publicado. Marcadores se detectan del PDF real en el navegador.
      file:"Christian_Arleo_Portfolio_EN.pdf",
      url:bucket+"Christian_Arleo_Portfolio_EN.pdf",
      filename:"Christian_Arleo_Portfolio_EN.pdf",
      title:"Professional portfolio of Christian Gabriel Arleo",
      sections:null,
      // Fallback visual SOLO para la edición inglesa de 55 páginas (igual extensión que
      // la española). El lector busca y reemplaza estos valores a partir del propio PDF.
      fallback55:{index:3,intro:4,summary:5,projects:6,experience:23}
    }
  };
  window.CGAPortfolioFiles=config;
})();