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
  ],
  // English only, by the family's choice: no language switch. The `bn` values
  // below are kept but unused; add { code: "bn", … } back here to restore them.
  defaultLang: "en",

  couple: {
    groom: { en: "Subhadip", bn: "শুভ" },
    bride: { en: "Sneha", bn: "স্নেহা" },
  },
  dateLine: { en: "10–13 December 2026 · Kolkata", bn: "১০–১৩ ডিসেম্বর ২০২৬ · কলকাতা" },

  // The hero's wording, from the bride's family's printed invitation card, in
  // their voice (bride first, "our only daughter").
  invitation: {
    invocation: { en: ":: With the divine blessings of Shri Shri Jagannath Mahaprabhu ::", bn: "॥ শ্রী শ্রী জগন্নাথ মহাপ্রভুর আশীর্বাদে ॥" },
    announce: { en: "We are delighted to announce the wedding of our only daughter", bn: "আনন্দের সঙ্গে জানাই, আমাদের একমাত্র কন্যার শুভ বিবাহ" },
    bride: { en: "Sneha Khasnabis", bn: "স্নেহা খাসনবিশ" },
    joiner: { en: "with", bn: "ও" },
    groom: { en: "Subhadip Dutta", bn: "শুভদীপ দত্ত" },
    groomParents: { en: "the only son of Mr. Sadananda Dutta and Mrs. Uma Dutta", bn: "শ্রী সদানন্দ দত্ত ও শ্রীমতী উমা দত্তের একমাত্র পুত্র" },
    closing: {
      en: "On this auspicious occasion, we warmly invite you to grace the celebration with your presence and bless the newlyweds with your love and heartfelt blessings. With warm regards and best wishes.",
      bn: "এই শুভ অনুষ্ঠানে আপনার সপরিবার উপস্থিতি ও নবদম্পতির প্রতি আন্তরিক আশীর্বাদ একান্ত কাম্য। শুভেচ্ছা ও শ্রদ্ধা সহ।",
    },
  },
  // "Our families", under the hero, from the family's card. Bride's side first,
  // as on the hero. `portrait` is an illustrated cut-out made by
  // tools/cutout_portraits.py; set it to null and an S&S seal stands in.
  // Set `families: null` to hide the section.
  families: [
    {
      side: "bride",
      name: { en: "Sneha Khasnabis", bn: "স্নেহা খাসনবিশ" },
      parents: { en: "Daughter of Mr. Sudeep Khasnabis and Mrs. Sumita Khasnabis", bn: "শ্রী সুদীপ খাসনবিশ ও শ্রীমতী সুমিতা খাসনবিশের কন্যা" },
      place: { en: "Kolkata", bn: "কলকাতা" },
      portrait: {
        src: "assets/families/bride.webp", w: 480, h: 672,
        alt: { en: "Illustration of Sneha as a bride, in a red and gold Banarasi and a white shola crown", bn: "কনের সাজে স্নেহার ছবি, লাল-সোনালি বেনারসি আর সাদা শোলার মুকুটে" },
      },
    },
    {
      side: "groom",
      name: { en: "Subhadip Dutta", bn: "শুভদীপ দত্ত" },
      parents: { en: "Son of Mr. Sadananda Dutta and Mrs. Uma Dutta", bn: "শ্রী সদানন্দ দত্ত ও শ্রীমতী উমা দত্তের পুত্র" },
      place: { en: "Kolkata", bn: "কলকাতা" },
      portrait: {
        src: "assets/families/groom.webp", w: 480, h: 672,
        alt: { en: "Illustration of Subhadip as a groom, in a white topor, cream panjabi and dhoti, and a red shawl", bn: "বরের সাজে শুভদীপের ছবি, সাদা টোপর, ঘিয়ে পাঞ্জাবি-ধুতি আর লাল উত্তরীয়তে" },
      },
    },
  ],
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
      startTime: "18:00", // "18:30" in IST once confirmed
      endTime: "23:00",
      venue: { name: "Regenta Orkos", address: "https://maps.app.goo.gl/QrPJnzLGziHTmyzNA" }, // { name: "…", address: "…" }
      look: "sangeet",
    },
    {
      id: "haldi",
      name: { en: "Haldi", bn: "গায়ে হলুদ" },
      gloss: { en: "Gaye holud, the turmeric blessing", bn: "হলুদ ছোঁয়ানোর মঙ্গল অনুষ্ঠান" },
      date: "2026-12-11",
      startTime: "10:00",
      endTime: "13:00",
      venue: { name: "Regenta Orkos", address: "https://maps.app.goo.gl/QrPJnzLGziHTmyzNA" },
      look: "haldi",
    },
    {
      id: "wedding",
      name: { en: "Wedding", bn: "বিয়ে" },
      gloss: { en: "The Biye, at the auspicious lagna", bn: "শুভ লগ্নে বিবাহ অনুষ্ঠান" },
      date: "2026-12-11",
      startTime: "18:00",
      endTime: "22:00",
      venue: { name: "Regenta Orkos", address: "https://maps.app.goo.gl/QrPJnzLGziHTmyzNA" },
      look: "biye",
    },
    {
      id: "reception",
      name: { en: "Reception", bn: "প্রীতিভোজ" },
      gloss: { en: "Dinner and celebration with everyone", bn: "সবার সঙ্গে নৈশভোজ ও আনন্দ" },
      date: "2026-12-13",
      startTime: "18:00",
      endTime: "23:30",
      venue: { name: "Princeton Club", address: "https://maps.app.goo.gl/V9ARwFyHi6Z4qXLB6" },
      look: "reception",
    },
  ],

  // The couple's look for each ceremony, cut out of the family's illustrated
  // renders by tools/cutout_avatars.py (same scale and floor line, each centred).
  // Changing looks plays one transition everywhere: the outfit breaks into
  // pixels that swirl around the couple in 3D and re-form as the next look.
  // `palette` colours those pixels mid-flight, one set per ceremony.
  // `video` is the look as a looping animated cutout (tools/cutout_videos.py),
  // played over the still once a change into it settles; null keeps the still.
  // Haldi and Reception wait for clips re-made on plain black.
  avatars: [
    {
      id: "sangeet", src: "assets/avatars/sangeet.webp", video: "assets/avatars/sangeet.mp4", event: "sangeet",
      palette: ["#1f7a4a", "#2f5fa8", "#d4af37", "#f3e3b5"], // emerald lehenga, royal-blue kurta, gold
      title: { en: "Sangeet", bn: "সঙ্গীত" },
      outfit: { en: "Blue kurta and an emerald lehenga", bn: "নীল কুর্তা আর পান্না-সবুজ লেহেঙ্গা" },
    },
    {
      id: "haldi", src: "assets/avatars/haldi.webp", video: null, event: "haldi",
      palette: ["#f2a531", "#e8892a", "#f7c948", "#d9531e"], // marigold and turmeric
      title: { en: "Haldi", bn: "গায়ে হলুদ" },
      outfit: { en: "Yellow panjabi and a saree with flower jewellery", bn: "হলুদ পাঞ্জাবি আর ফুলের গয়নায় হলুদ শাড়ি" },
    },
    {
      id: "biye", src: "assets/avatars/biye.webp", video: null, event: "wedding",
      palette: ["#b3262e", "#d4382f", "#d4af37", "#faeedc"], // sindoor red, gold, shola white
      title: { en: "Biye", bn: "বিয়ে" },
      outfit: { en: "Topor, dhoti and a red Banarasi", bn: "টোপর, ধুতি আর লাল বেনারসি" },
    },
    {
      id: "reception", src: "assets/avatars/reception.webp", video: null, event: "reception",
      palette: ["#5b1f6e", "#7d3a8f", "#d4af37", "#e8d3a2"], // purple Banarasi, gold zari, champagne
      title: { en: "Reception", bn: "প্রীতিভোজ" },
      outfit: { en: "Navy suit and a purple Banarasi", bn: "নেভি স্যুট আর বেগুনি বেনারসি" },
    },
  ],
  // The hero opens on the Biye look; its buttons switch between these.
  heroAvatar: "biye",
  heroLooks: ["sangeet", "haldi", "biye", "reception"],

  // The family should set `confirmed: true` only for rituals taking place.
  // `null` keeps the useful explainer visible while clearly marking it pending.
  rituals: [
    { id: "gaye-holud", confirmed: true, name: { en: "Gaye Holud", bn: "গায়ে হলুদ" }, short: { en: "Turmeric blessings shared with the couple.", bn: "হলুদের আশীর্বাদে ভরে ওঠে দুই পক্ষের ঘর।" } },
    { id: "shubho-drishti", confirmed: true, name: { en: "Shubho Drishti", bn: "শুভদৃষ্টি" }, short: { en: "The couple share their first ceremonial glance.", bn: "আচার মেনে প্রথমবার একে অপরের দিকে তাকান দুজন।" } },
    { id: "mala-badal", confirmed: true, name: { en: "Mala Badal", bn: "মালাবদল" }, short: { en: "They exchange flower garlands, with plenty of cheering.", bn: "হাসি-উল্লাসের মধ্যে ফুলের মালা বদল হয়।" } },
    { id: "saat-paak", confirmed: true, name: { en: "Saat Paak", bn: "সাত পাক" }, short: { en: "The bride is carried in seven circles around the groom.", bn: "কনেকে নিয়ে বরকে সাত বার প্রদক্ষিণ করা হয়।" } },
    { id: "sindoor-daan", confirmed: true, name: { en: "Sindoor Daan", bn: "সিঁদুর দান" }, short: { en: "A vermilion blessing marks a new chapter together.", bn: "সিঁদুরের আশীর্বাদে শুরু হয় নতুন অধ্যায়।" } },
    { id: "bou-bhaat", confirmed: true, name: { en: "Bou Bhaat", bn: "বউভাত" }, short: { en: "The newlywed bride is welcomed with a celebratory meal.", bn: "নববধূকে স্বাগত জানিয়ে হয় আনন্দের ভোজ।" } },
  ],

  // This becomes visible automatically in Kolkata from 10–13 December.
  // Add the family contacts, confirmed lagna time and private livestream URL
  // before sharing the wedding-day link.
  weddingDay: {
    start: "2026-12-10", end: "2026-12-13",
    contacts: [], // { name: "…", phone: "+91…", role: { en: "Family contact", bn: "পারিবারিক যোগাযোগ" } }
    livestream: null, // { url: "https://…", label: { en: "Watch the livestream", bn: "লাইভ দেখুন" } }
    lagnaTime: null,
  },

  // Real photos. Add with /add-gallery-media so GPS data is stripped first.
  // { src: "assets/photos/2024-puja-1.webp", alt: { en: "…", bn: "…" }, caption: { en: "Puja, 2024", bn: "পুজো, ২০২৪" }, w: 1200, h: 1600 }
  photos: [
    { src: "assets/photos/us-1.webp", alt: { en: "Subh and Sneha standing under the trees at a hilltop viewpoint, green valleys and clouds behind them", bn: "পাহাড়ের চূড়ায় গাছের ছায়ায় দাঁড়িয়ে শুভ আর স্নেহা, পিছনে সবুজ উপত্যকা আর মেঘ" }, caption: { en: "June 2025", bn: "জুন ২০২৫" }, comment: { en: "All that climbing for one photo. Worth it.", bn: "একটা ছবির জন্য এত চড়াই। পুরো সার্থক।" }, w: 1384, h: 1600 },
    { src: "assets/photos/us-2.webp", alt: { en: "Subh and Sneha sitting close on a rocky hilltop above a lake, laughing", bn: "লেকের ওপরে পাথুরে পাহাড়ের মাথায় পাশাপাশি বসে হাসছে শুভ আর স্নেহা" }, caption: { en: "December 2025", bn: "ডিসেম্বর ২০২৫" }, comment: { en: "Top of the hill, top of the world.", bn: "পাহাড়ের চূড়ায়, যেন পৃথিবীর মাথায়।" }, w: 1200, h: 1600 },
    { src: "assets/photos/us-3.webp", alt: { en: "Subh and Sneha sitting face to face at a viewpoint under a big blue sky and clouds", bn: "বিশাল নীল আকাশ আর মেঘের নীচে এক ভিউপয়েন্টে মুখোমুখি বসে শুভ আর স্নেহা" }, caption: { en: "February 2026", bn: "ফেব্রুয়ারি ২০২৬" }, comment: { en: "Head in the clouds, quite literally.", bn: "মেঘের দেশে, একেবারে আক্ষরিক অর্থেই।" }, w: 1200, h: 1600 },
    { src: "assets/photos/us-4.webp", alt: { en: "Sneha's and Subh's hands together on a car's steering wheel, a tree-lined road ahead", bn: "গাড়ির স্টিয়ারিংয়ে স্নেহা আর শুভর হাত, সামনে গাছে ঘেরা রাস্তা" }, caption: { en: "February 2026", bn: "ফেব্রুয়ারি ২০২৬" }, comment: { en: "Sharing the wheel already.", bn: "স্টিয়ারিং ভাগাভাগি, এখন থেকেই।" }, w: 1200, h: 1600 },
    { src: "assets/photos/us-5.webp", alt: { en: "Sneha in a red dress leading Subh by the hand through a pine forest", bn: "লাল পোশাকে স্নেহা শুভর হাত ধরে পাইন বনের মধ্যে দিয়ে এগিয়ে চলেছে" }, caption: { en: "February 2026", bn: "ফেব্রুয়ারি ২০২৬" }, comment: { en: "“Follow me.” He did.", bn: "“চলো আমার সঙ্গে।” সে চলল।" }, w: 1200, h: 1600 },
    { src: "assets/photos/us-6.webp", alt: { en: "A watercolour illustration of Subh and Sneha dancing, she in a navy and gold lehenga, he in an ivory sherwani", bn: "শুভ আর স্নেহার নাচের জলরঙের ছবি, স্নেহার পরনে নীল-সোনালি লেহেঙ্গা, শুভর পরনে হাতির দাঁত রঙের শেরওয়ানি" }, caption: { en: "Up next…", bn: "এরপর…" }, comment: { en: "See you in Kolkata this December.", bn: "এই ডিসেম্বরে কলকাতায় দেখা হচ্ছে।" }, w: 1167, h: 1600 },
  ],

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
