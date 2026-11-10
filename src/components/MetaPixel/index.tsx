import React from 'react'

const pixelID = '1123550367331651'

/** One base installation per independent storefront document, never in admin. */
export function MetaPixelScript() {
  return <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
if(!window.__nskiMetaInitialized){
window.__nskiMetaInitialized=true;
fbq('init','${pixelID}');
fbq('track','PageView');
window.__nskiMetaPath=window.location.pathname;
}` }} />
}

export function MetaPixelNoScript() {
  return <noscript>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img height="1" width="1" style={{ display: 'none' }} alt=""
      src={`https://www.facebook.com/tr?id=${pixelID}&ev=PageView&noscript=1`} />
  </noscript>
}
