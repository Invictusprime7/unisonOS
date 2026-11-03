// MobileNavigation.jsx
import React from "react";
import * as Dialog from "../unison/ui/radix/dialog";
import { Menu, X } from "../unison/ui/icons";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Navigation = __LucideIcons['Navigation'] || __LucideFallback;
function MobileNavigation({
  brand,
  links = [],
  cta
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);
  return /* @__PURE__ */React.createElement("div", {
    className: "utx78zum5 utx1wdgsqc utx6s0dn4 utx8fetqu utx1uqea4d utx1uz70x1 utx1b4jn95 utxqzvrys",
    "data-ut-mobile-navigation": "radix-stylex"
  }, /* @__PURE__ */React.createElement("a", {
    href: "#",
    className: "utx1iyjqo2 utxeuugli utxj0a0fe utxylgur7 utx1s688f utx1603h9y utx37zpob utx1heor9g utx1hl2dhg"
  }, brand), /* @__PURE__ */React.createElement(Dialog.Root, {
    open,
    onOpenChange: setOpen
  }, /* @__PURE__ */React.createElement(Dialog.Trigger, {
    asChild: true
  }, /* @__PURE__ */React.createElement("button", {
    type: "button",
    "aria-label": "Open navigation",
    className: "utx3nfvp2 utx6s0dn4 utxl56j7k utx2lah0s utxb1qrhf utx12hms15 utx1fe46o7 utx1b4jn95 utxqzvrys utx1ypdohk utx1a2a7pz utx1svt1u2 utx1ewu8gn"
  }, /* @__PURE__ */React.createElement(Menu, {
    "aria-hidden": "true",
    size: 20
  }))), /* @__PURE__ */React.createElement(Dialog.Portal, null, /* @__PURE__ */React.createElement(Dialog.Overlay, {
    className: "utxixxii4 utx10a8y8t utx11uqc5h utx10d9a90"
  }), /* @__PURE__ */React.createElement(Dialog.Content, {
    "aria-describedby": void 0,
    className: "utxixxii4 utx10no89f utxtijo5x utx1rozsjd utx3d859g utx9f619 utx1odjw0f utxis3749 utx1b4jn95 utxqzvrys utxva6cmm"
  }, /* @__PURE__ */React.createElement("div", {
    className: "utx78zum5 utx6s0dn4 utx1qughib utx8fetqu utx1t84w78"
  }, /* @__PURE__ */React.createElement(Dialog.Title, {
    className: "utx1ghz6dp utxylgur7 utxngnso2 utxj0a0fe"
  }, "Navigation"), /* @__PURE__ */React.createElement(Dialog.Close, {
    asChild: true
  }, /* @__PURE__ */React.createElement("button", {
    type: "button",
    "aria-label": "Close navigation",
    className: "utx3nfvp2 utx6s0dn4 utxl56j7k utx2lah0s utxb1qrhf utx12hms15 utx1fe46o7 utx1b4jn95 utxqzvrys utx1ypdohk utx1a2a7pz utx1svt1u2 utx1ewu8gn"
  }, /* @__PURE__ */React.createElement(X, {
    "aria-hidden": "true",
    size: 20
  })))), /* @__PURE__ */React.createElement("nav", {
    "aria-label": "Mobile navigation",
    className: "utx78zum5 utxdt5ytf utx13z6uf9"
  }, (Array.isArray(links) ? links : []).map((link, index) => /* @__PURE__ */React.createElement(Dialog.Close, {
    asChild: true,
    key: index
  }, /* @__PURE__ */React.createElement("a", {
    href: link.href || "#",
    "data-ut-intent": link.intent,
    className: "utx78zum5 utx6s0dn4 utxgbkey0 utx79iv2k utxj0a0fe utx1hl2dhg utxqzvrys utx1fe46o7 utxjbqb8w utxlbouxd utx1a2a7pz utx1svt1u2 utx1hl8ikr"
  }, link.label))), cta && /* @__PURE__ */React.createElement(Dialog.Close, {
    asChild: true
  }, /* @__PURE__ */React.createElement("a", {
    href: cta.href || "#",
    "data-ut-intent": cta.intent,
    className: "utx78zum5 utx6s0dn4 utxgbkey0 utx79iv2k utxj0a0fe utx1hl2dhg utx1fe46o7 utx1a2a7pz utx1svt1u2 utx1hl8ikr utxj1urod utxdl2yti utx1i2slih utxrwwme7 utx1s688f"
  }, cta.label)))))));
}
export default MobileNavigation;