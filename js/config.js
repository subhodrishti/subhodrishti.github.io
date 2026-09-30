/*
 * Everything a guest reads that might change lives here: names, events,
 * looks, gallery, polls, sound and where replies are sent. The page's own
 * interface words live in js/strings.js. The rest of js/ only renders.
 *
 * Bilingual fields are { en, bn }. The Bengali was drafted by Claude and must
 * be read by a Bengali-speaking family member before guests see it.
 *
 * Event dates mirror ../wedding/inputs/timeline.json (the family's source of
 * truth). Run /sync-events after that file changes; never edit it from here.
 * A null time or venue renders as "to be announced", so leave unknowns null.
 */
window.INVITE = {
  languages: [
    { code: "en", label: "English", short: "EN" },
    { code: "bn", label: "বাংলা", short: "বাং" },
  ],
  // Guests can switch any time; ?lang=bn in a link opens in Bengali.
  defaultLang: "en",

  couple: {
    groom: { en: "Subh", bn: "শুভ" },
    bride: { en: "Sneha", bn: "স্নেহা" },
  },
  dateLine: { en: "10–13 December 2026 · Kolkata", bn: "১০–১৩ ডিসেম্বর ২০২৬ · কলকাতা" },
  city: "Kolkata, West Bengal", // used for map searches, not shown

  // Chronological. `id` must stay stable: RSVP rows store it, and
  // backend/google-apps-script.gs validates against the same list.
  // `look` is the couple's own outfit for that ceremony (the family's themed
  // renders), shown beside the card as guests scroll. It is never presented
  // as a dress code for guests. Set every look to null to hide the stage.
  events: [
    {
      id: "sangeet",
      name: { en: "Sangeet", bn: "সঙ্গীত" },
      gloss: { en: "An evening of music and dance", bn: "গান আর নাচের সন্ধ্যা" },
      date: "2026-12-10",
      startTime: null, // "18:30" in IST once confirmed
      endTime: null,
      venue: null, // { name: "…", address: "…" }
      look: "sangeet",
    },
    {
      id: "haldi",
      name: { en: "Haldi", bn: "গায়ে হলুদ" },
      gloss: { en: "Gaye holud, the turmeric blessing", bn: "হলুদ ছোঁয়ানোর মঙ্গল অনুষ্ঠান" },
      date: "2026-12-11",
      startTime: null,
      endTime: null,
      venue: null,
      look: "haldi",
    },
    {
      id: "wedding",
      name: { en: "Wedding", bn: "বিয়ে" },
      gloss: { en: "The Biye, at the auspicious lagna", bn: "শুভ লগ্নে বিবাহ অনুষ্ঠান" },
      date: "2026-12-11",
      startTime: null,
      endTime: null,
      venue: null,
      look: "biye",
    },
    {
      id: "reception",
      name: { en: "Reception", bn: "প্রীতিভোজ" },
      gloss: { en: "Dinner and celebration with everyone", bn: "সবার সঙ্গে নৈশভোজ ও আনন্দ" },
      date: "2026-12-13",
      startTime: null,
      endTime: null,
      venue: null,
      look: "reception",
    },
  ],

  // The couple's 3D avatar look for each ceremony, cut out by
  // tools/cutout_avatars.py (same size and floor line, each centred).
  // Changing looks plays one transition everywhere: the outfit breaks into
  // pixels that swirl around the couple in 3D and re-form as the next look.
  // `palette` colours those pixels mid-flight, one set per ceremony.
  avatars: [
    {
      id: "sangeet", src: "assets/avatars/sangeet.webp", event: "sangeet",
      palette: ["#e0457b", "#f06ea0", "#ffd1e0", "#d4af37"], // lehenga pink and gold
      title: { en: "Sangeet", bn: "সঙ্গীত" },
      outfit: { en: "Gold Nehru jacket and a pink lehenga", bn: "সোনালি নেহরু জ্যাকেট আর গোলাপি লেহেঙ্গা" },
    },
    {
      id: "haldi", src: "assets/avatars/haldi.webp", event: "haldi",
      palette: ["#f2a531", "#e8892a", "#f7c948", "#d9531e"], // marigold and turmeric
      title: { en: "Haldi", bn: "গায়ে হলুদ" },
      outfit: { en: "Marigold garland and a red-bordered saree", bn: "গাঁদার মালা আর লালপাড় হলুদ শাড়ি" },
    },
    {
      id: "biye", src: "assets/avatars/biye.webp", event: "wedding",
      palette: ["#b3262e", "#d4382f", "#d4af37", "#faeedc"], // sindoor red, gold, shola white
      title: { en: "Biye", bn: "বিয়ে" },
      outfit: { en: "Topor, dhoti and a red Banarasi", bn: "টোপর, ধুতি আর লাল বেনারসি" },
    },
    {
      id: "reception", src: "assets/avatars/reception.webp", event: "reception",
      palette: ["#7a1f2b", "#a33a45", "#e8d3a2", "#d4af37"], // maroon, champagne, gold
      title: { en: "Reception", bn: "প্রীতিভোজ" },
      outfit: { en: "Maroon sherwani and a gold silk saree", bn: "মেরুন শেরওয়ানি আর সোনালি সিল্কের শাড়ি" },
    },
  ],
  // The hero opens on the Biye look; its buttons switch between these.
  heroAvatar: "biye",
  heroLooks: ["sangeet", "haldi", "biye", "reception"],

  // Real photos. Add with /add-gallery-media so GPS data is stripped first.
  // { src: "assets/photos/2024-puja-1.webp", alt: { en: "…", bn: "…" }, caption: { en: "Puja, 2024", bn: "পুজো, ২০২৪" }, w: 1200, h: 1600 }
  photos: [],

  polls: {
    // Votes go to polls.endpoint, or rsvp.endpoint when this is empty.
    // With no endpoint at all, picks stay on the device and no results show.
    endpoint: "",
    // Show live #TeamGroom/#TeamBride percentages after each vote.
    showResults: true,
    // Below this many votes a question shows counts, not percentages.
    minVotesForPercent: 5,
    questions: [
      { id: "ready", text: { en: "Who takes longer to get ready?", bn: "কার সাজতে বেশি সময় লাগে?" } },
      { id: "dance", text: { en: "Who owns the dance floor at the Sangeet?", bn: "সঙ্গীতের রাতে ডান্স ফ্লোর কার দখলে?" } },
      { id: "iloveyou", text: { en: "Who said “I love you” first?", bn: "“ভালোবাসি” প্রথম কে বলেছিল?" } },
      { id: "tears", text: { en: "Who gets emotional first at the Biye?", bn: "বিয়ের সময় প্রথম কার চোখে জল আসবে?" } },
      { id: "cook", text: { en: "Who is the better cook?", bn: "রান্নায় কে বেশি পাকা?" } },
      { id: "food", text: { en: "Who wins the “where shall we eat” debate?", bn: "“কোথায় খেতে যাব” তর্কে কে জেতে?" } },
      { id: "late", text: { en: "Who is more likely to be late to their own Haldi?", bn: "নিজের গায়ে হলুদে কার দেরি হওয়ার সম্ভাবনা বেশি?" } },
    ],
    reactions: {
      groom: {
        en: ["Subh thanks you for your loyalty.", "One more for the groom’s side.", "The groom’s side is cheering."],
        bn: ["শুভ আপনার সমর্থনে কৃতজ্ঞ।", "বরের দলে আরও একজন।", "বরপক্ষ খুশিতে হাততালি দিচ্ছে।"],
      },
      bride: {
        en: ["Sneha thanks you for your loyalty.", "One more for the bride’s side.", "The bride’s side is cheering."],
        bn: ["স্নেহা আপনার সমর্থনে কৃতজ্ঞ।", "কনের দলে আরও একজন।", "কনেপক্ষ খুশিতে হাততালি দিচ্ছে।"],
      },
    },
  },

  // Sound starts only when a guest taps the seal (browsers allow audio after
  // a tap), and only if "With sound" is on. A floating button mutes it.
  audio: {
    onByDefault: true,
    tracks: {
      shankh: { src: "assets/audio/shankh.mp3", volume: 0.9 },
      // Record the family's own ulu; see assets/audio/CREDITS.md.
      ulu: { src: null, volume: 0.8, delay: 1.1 },
      shehnai: { src: "assets/audio/shehnai.mp3", volume: 0.32, delay: 3.5, loop: true },
    },
    credits: {
      en: "Conch recording by David Bolton (CC BY 2.5). “Veena And Shenai” by Antti Luode (CC BY 3.0).",
      bn: "শাঁখের রেকর্ডিং: ডেভিড বোল্টন (CC BY 2.5)। “Veena And Shenai”: আন্টি লুওডে (CC BY 3.0)।",
    },
  },

  rsvp: {
    // Google Apps Script web-app URL (see backend/google-apps-script.gs).
    // Leave empty only while testing: replies are then kept on this device.
    endpoint: "",
    deadline: null, // "2026-11-15"
    maxGuests: 6,
    // `id` is what the sheet stores; labels are what guests see.
    diets: [
      { id: "Vegetarian", label: { en: "Vegetarian", bn: "নিরামিষ" } },
      { id: "Non-vegetarian", label: { en: "Non-vegetarian", bn: "আমিষ" } },
      { id: "Jain", label: { en: "Jain", bn: "জৈন" } },
      { id: "Vegan", label: { en: "Vegan", bn: "ভিগান" } },
    ],
  },
};
