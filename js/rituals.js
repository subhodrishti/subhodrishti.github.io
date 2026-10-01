/* A gentle, family-confirmed orientation for guests who are new to Bengali
   wedding customs. Cultural descriptions are deliberately short: every
   family has its own order and variations. */
(function () {
  const { $, h, get, L, t } = window.Invite;
  const objectStories = {
    topor: {
      title: { en: "The topor", bn: "টোপর" },
      body: { en: "This light, ornate shola crown is traditionally worn by the groom. In this invitation, it is also a small doorway into the wedding rituals.", bn: "শোলার তৈরি এই হালকা অলংকৃত মুকুটটি ঐতিহ্যগতভাবে বর পরেন। আমাদের নিমন্ত্রণে এটি বিয়ের আচারগুলির একটি ছোট জানলা।" },
    },
    paan: {
      title: { en: "The paan leaf", bn: "পানের পাতা" },
      body: { en: "The betel leaf appears in many Bengali ceremonies as a symbol of welcome and auspicious beginnings. It may also play a part in the rituals the family chooses to include.", bn: "পানের পাতা বাঙালি নানা অনুষ্ঠানে অভ্যর্থনা ও শুভ সূচনার প্রতীক। পরিবার যে আচারগুলি রাখবে, তাতেও এর ভূমিকা থাকতে পারে।" },
    },
  };

  function render() {
    const list = $("#ritual-list");
    if (!list) return;
    const rituals = get("rituals") || [];
    list.replaceChildren(...rituals.map((ritual, index) => {
      const status = ritual.confirmed === true ? t("rituals.confirmed") : t("rituals.pending");
      return h("article", { class: `ritual${ritual.confirmed === true ? " is-confirmed" : ""}` },
        h("span", { class: "ritual__number", "aria-hidden": "true" }, String(index + 1).padStart(2, "0")),
        h("p", { class: "ritual__status" }, status),
        h("h3", {}, L(ritual.name)),
        h("p", {}, L(ritual.short)),
      );
    }));
    const confirmed = rituals.filter((r) => r.confirmed === true).length;
    $("#rituals-notice").textContent = confirmed
      ? t("rituals.confirmedNotice", { n: confirmed })
      : t("rituals.pendingNotice");
    if (!window.Invite.reducedMotion.matches) {
      const observer = new IntersectionObserver((entries, obs) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); obs.unobserve(entry.target); }
      }), { threshold: 0.18 });
      list.querySelectorAll(".ritual").forEach((card) => observer.observe(card));
    } else list.querySelectorAll(".ritual").forEach((card) => card.classList.add("is-visible"));
  }

  function openStory(id) {
    const story = objectStories[id];
    const dlg = $("#object-story");
    if (!story || !dlg) return;
    $("#object-story-kicker").textContent = t("rituals.objectStory");
    $("#object-story-title").textContent = L(story.title);
    $("#object-story-body").textContent = L(story.body);
    dlg.showModal();
  }

  function init() { render(); }
  window.Invite.rituals = { init, render, openStory };
})();
