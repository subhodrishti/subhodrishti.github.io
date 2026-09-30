/* #TeamGroom vs #TeamBride: a stack of skippable cards.
 *
 * With a poll endpoint (polls.endpoint, else rsvp.endpoint), each vote is
 * stored against a random id for this browser, so changing a pick updates the
 * vote instead of adding one, and the card then shows the live split from the
 * sheet. Without an endpoint, picks stay on the device and no numbers appear:
 * the page never shows a tally it didn't receive.
 */
(function () {
  const { $, h, get, L, t, num, names, store, postJSON, getJSON, deviceId, reducedMotion } = window.Invite;

  const LEAVE_MS = 480;
  let questions, answers, deck;
  let resultsFor = null; // { qid, pick, tally } while a result card is showing

  const endpoint = () => get("polls.endpoint") || get("rsvp.endpoint") || "";
  const live = () => !!endpoint() && get("polls.showResults") !== false;
  const nextIndex = () => questions.findIndex((q) => !(q.id in answers));
  const pickOne = (list) => list[(Math.random() * list.length) | 0];

  function card(depth, children, extraClass = "") {
    return h("article", { class: `poll glass glass--light ${extraClass}`, "data-depth": depth, "aria-hidden": depth ? "true" : null }, children);
  }

  /* ---------- Results ---------- */
  function voteLabel(n) {
    return n === 1 ? t("polls.oneVote") : t("polls.votes", { n: num(n) });
  }

  /** The two-sided bar. Percentages only once enough people have voted. */
  function resultBar(tally, mine) {
    const g = tally.groom | 0, b = tally.bride | 0, total = g + b;
    const enough = total >= (get("polls.minVotesForPercent") || 5);
    const gp = total ? Math.round((g / total) * 100) : 50;
    const bp = total ? 100 - gp : 50;
    const { groom, bride } = names();
    const side = (who, value) => enough ? `${num(value)}%` : num(who === "groom" ? g : b);
    const bar = h("div", { class: "result", role: "img",
      "aria-label": `#TeamGroom ${side("groom", gp)}, #TeamBride ${side("bride", bp)}, ${voteLabel(total)}` },
      h("div", { class: "result__labels", "aria-hidden": "true" },
        h("span", { class: `g${mine === "groom" ? " is-mine" : ""}` }, h("b", {}, side("groom", gp)), ` ${groom}`),
        h("span", { class: `b${mine === "bride" ? " is-mine" : ""}` }, `${bride} `, h("b", {}, side("bride", bp))),
      ),
      h("div", { class: "result__track", "aria-hidden": "true" },
        h("span", { class: "result__g", style: `--w:${gp}%` }),
        h("span", { class: "result__b", style: `--w:${bp}%` }),
      ),
      h("p", { class: "result__total" }, enough ? voteLabel(total) : t("polls.early", { n: num(total) })),
    );
    // Let the bars grow from the middle on the next frame.
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("is-shown")));
    return bar;
  }

  function advance(cardEl, dir) {
    resultsFor = null;
    cardEl.classList.add(`is-leaving-${dir}`);
    setTimeout(render, reducedMotion.matches ? 120 : LEAVE_MS);
  }

  function answer(q, choice, cardEl) {
    answers[q.id] = choice;
    store.set("polls", answers);
    cardEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const dir = choice === "groom" ? "left" : choice === "bride" ? "right" : "down";

    if (choice === "skip") { advance(cardEl, dir); return; }

    const reaction = cardEl.querySelector(".poll__reaction");
    reaction.textContent = pickOne(L(get(`polls.reactions.${choice}`)));

    if (!live()) {
      if (endpoint()) sendVote(q, choice).catch(() => {});
      setTimeout(() => advance(cardEl, dir), reducedMotion.matches ? 0 : 900);
      return;
    }

    // Live results: show the split, then let the guest move on when ready.
    const slot = cardEl.querySelector(".poll__result");
    const nextBtn = cardEl.querySelector(".poll__next");
    const isLast = questions.slice(questions.indexOf(q) + 1).every((x) => x.id in answers);
    nextBtn.textContent = isLast ? t("polls.seeResults") : t("polls.next");
    nextBtn.onclick = () => advance(cardEl, dir);
    nextBtn.hidden = false;
    nextBtn.disabled = false;
    cardEl.querySelector(".poll__options").hidden = true;
    cardEl.querySelector(".poll__skip").hidden = true;
    nextBtn.focus({ preventScroll: true });
    resultsFor = { qid: q.id, pick: choice, tally: null };

    sendVote(q, choice)
      .then((res) => {
        if (!res?.tally || resultsFor?.qid !== q.id) return;
        resultsFor.tally = res.tally;
        // The card may have been rebuilt by a language switch; find the live one.
        const target = cardEl.isConnected ? slot : deck.querySelector('[data-depth="0"] .poll__result');
        target?.replaceChildren(resultBar(res.tally, choice));
      })
      .catch(() => { /* network trouble: the guest still sees their reaction and can move on */ });
  }

  function sendVote(q, pick) {
    return postJSON(endpoint(), { type: "poll", question: q.id, pick, device: deviceId() }, { timeout: 8000 });
  }

  /* ---------- Cards ---------- */
  function questionCard(q, i) {
    const { groom, bride } = names();
    let el;
    const opt = (side, name, tag) =>
      h("button", { class: `poll__opt poll__opt--${side}`, type: "button", onclick: () => answer(q, side, el) },
        h("strong", {}, name), h("span", {}, tag));
    const showing = resultsFor?.qid === q.id ? resultsFor : null;
    el = card(0, [
      h("p", { class: "poll__count" }, t("polls.count", { i: num(i + 1), n: num(questions.length) })),
      h("h3", { class: "poll__q", id: `q-${q.id}` }, L(q.text)),
      h("div", { class: "poll__options", role: "group", "aria-labelledby": `q-${q.id}` },
        opt("groom", groom, "#TeamGroom"),
        opt("bride", bride, "#TeamBride"),
      ),
      h("button", { class: "linkish poll__skip", type: "button", onclick: () => answer(q, "skip", el) }, t("polls.skip")),
      h("p", { class: "poll__reaction" }),
      h("div", { class: "poll__result", "aria-live": "polite" }, showing?.tally ? resultBar(showing.tally, showing.pick) : null),
      h("button", { class: "btn btn--ghost-dark poll__next", type: "button", hidden: true }, t("polls.next")),
    ]);
    return el;
  }

  function summaryCard() {
    const vals = Object.values(answers);
    const g = vals.filter((v) => v === "groom").length;
    const b = vals.filter((v) => v === "bride").length;
    const { groom, bride } = names();
    const verdict = g === b
      ? (g === 0 ? t("polls.skippedAll") : t("polls.balanced"))
      : g > b ? t("polls.allGroom") : t("polls.allBride");
    const everyone = h("div", { class: "poll__everyone", "aria-live": "polite" });
    if (live()) {
      getJSON(endpoint(), { type: "tallies" })
        .then((res) => {
          if (!res?.tallies) return;
          const sum = Object.values(res.tallies).reduce((acc, x) => ({ groom: acc.groom + (x.groom | 0), bride: acc.bride + (x.bride | 0) }), { groom: 0, bride: 0 });
          if (sum.groom + sum.bride === 0) return;
          everyone.replaceChildren(h("p", { class: "poll__count" }, t("polls.everyone")), resultBar(sum, null));
        })
        .catch(() => {});
    }
    return card(0, [
      h("p", { class: "poll__count" }, t("polls.yourPicks")),
      h("h3", { class: "poll__q" }, verdict),
      h("div", { class: "score" },
        h("div", { class: "g" }, h("b", {}, num(g)), h("small", {}, groom)),
        h("div", {}, "–"),
        h("div", { class: "b" }, h("b", {}, num(b)), h("small", {}, bride)),
      ),
      everyone,
      h("button", {
        class: "btn btn--ghost-dark", type: "button",
        onclick: () => { answers = {}; store.set("polls", answers); render(); deck.querySelector("button")?.focus(); },
      }, t("polls.again")),
    ], "poll--summary");
  }

  function render() {
    // A result card stays on screen (in the new language) until the guest moves on.
    const i = resultsFor ? questions.findIndex((q) => q.id === resultsFor.qid) : nextIndex();
    const hadFocus = deck.contains(document.activeElement);
    const cards = [];
    if (i === -1) {
      cards.push(summaryCard());
    } else {
      const qCard = questionCard(questions[i], i);
      cards.push(qCard);
      if (resultsFor) {
        // Rebuild the "answered" state after a language switch.
        const dir = resultsFor.pick === "groom" ? "left" : "right";
        qCard.querySelector(".poll__options").hidden = true;
        qCard.querySelector(".poll__skip").hidden = true;
        const nextBtn = qCard.querySelector(".poll__next");
        nextBtn.hidden = false;
        nextBtn.onclick = () => advance(qCard, dir);
      }
      const remaining = questions.length - i - 1;
      for (let d = 1; d <= Math.min(2, remaining); d++) cards.push(card(d, []));
    }
    // Ghosts first so the live card paints on top.
    deck.replaceChildren(...cards.reverse());
    if (hadFocus) deck.querySelector('[data-depth="0"] button:not([hidden])')?.focus({ preventScroll: true });
  }

  function init() {
    deck = $("#poll-deck");
    questions = get("polls.questions") || [];
    answers = store.get("polls", {});
    if (!questions.length) { $("#polls").hidden = true; return; }
    render();
  }

  window.Invite.polls = { init, render };
})();
