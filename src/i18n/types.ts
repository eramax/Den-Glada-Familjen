export type Lang = 'ar' | 'sv';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
}

export interface FormatCard {
  icon: string;
  title: string;
  text: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Principle {
  title: string;
  text: string;
}

export interface Activity {
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'teal' | 'navy' | 'rose';
  title: string;
  text: string;
}

export interface GalleryItem {
  key: 'community' | 'kids' | 'trip' | 'dinner';
  alt: string;
  caption: string;
}

export interface Step {
  title: string;
  text: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface SocialLabels {
  youtube: string;
  tiktok: string;
  whatsapp: string;
}

export interface Dict {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  meta: {
    title: string;
    description: string;
    ogLocale: string;
  };
  brand: {
    name: string;
    nameAlt: string;
    tagline: string;
  };
  nav: {
    items: NavItem[];
    join: string;
    menu: string;
    close: string;
  };
  a11y: {
    skip: string;
    langSwitch: string;
    logoAlt: string;
    external: string;
    backToTop: string;
    menuLabel: string;
    closeMenuLabel: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    titleHighlight: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    trust: string[];
    imageAlt: string;
    badgeTop: string;
    badgeTopSub: string;
    badgeBottom: string;
    circularText: string;
  };
  stats: Stat[];
  values: {
    label: string;
    items: string[];
  };
  about: {
    eyebrow: string;
    title: string;
    lead: string;
    body: string[];
    principles: Principle[];
    moreLabel: string;
    lessLabel: string;
    more: string[];
    quote: string;
    imageAltMain: string;
    imageAltSmall: string;
    foundedLabel: string;
    cityLabel: string;
  };
  activities: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Activity[];
    ctaTitle: string;
    ctaText: string;
    ctaLink: string;
  };
  motto: {
    eyebrow: string;
    parts: string[];
    text: string;
  };
  gallery: {
    eyebrow: string;
    title: string;
    lead: string;
    items: GalleryItem[];
    note: string;
    youtubeCta: string;
  };
  join: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: Step[];
    panelEyebrow: string;
    panelTitle: string;
    panelText: string;
    whatsapp: string;
    email: string;
    phoneLabel: string;
    note: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    helpTitle: string;
    helpText: string;
    helpCta: string;
    items: FaqItem[];
  };
  contact: {
    eyebrow: string;
    title: string;
    lead: string;
    emailLabel: string;
    whatsappLabel: string;
    locationLabel: string;
    location: string;
    locationNote: string;
    socialLabel: string;
    socials: SocialLabels;
    form: {
      title: string;
      name: string;
      namePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      message: string;
      messagePlaceholder: string;
      submit: string;
      note: string;
      opening: string;
      subject: string;
    };
  };
  meetingsPage: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    lead: string;
    scheduleLabel: string;
    scheduleTime: string;
    scheduleNote: string;
    nextLabel: string;
    locationLabel: string;
    location: string;
    venueShort: string;
    amenities: string;
    partner: string;
    formatLabel: string;
    formatTitle: string;
    formatLead: string;
    formatCards: FormatCard[];
    timelineLabel: string;
    timelineTitle: string;
    timelineLead: string;
    timelineEnd: string;
    latestLabel: string;
    allLabel: string;
    detailsLabel: string;
    summaryLabel: string;
    adultsLabel: string;
    childrenLabel: string;
    lectureLabel: string;
    takeawayLabel: string;
    videoLabel: string;
    photosLabel: string;
    note: string;
    shareTitle: string;
    shareText: string;
    shareCta: string;
    ctaTitle: string;
    ctaText: string;
    ctaWhatsapp: string;
    ctaJoin: string;
    backHome: string;
    ctaLanding: string;
  };
  footer: {
    about: string;
    quickLinks: string;
    contactTitle: string;
    followTitle: string;
    orgLabel: string;
    privacy: string;
    copyright: string;
    made: string;
    backToTop: string;
  };
}
