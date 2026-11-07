import type { ImageMetadata } from 'astro';
import aboutMain from '../assets/images/about-main.jpg';
import galleryCommunity from '../assets/images/gallery-community.jpg';
import galleryDinner from '../assets/images/gallery-dinner.jpg';
import galleryKids from '../assets/images/gallery-kids.jpg';
import meetingDialogue from '../assets/images/meeting-dialogue.jpg';
import meetingWorkshop from '../assets/images/meeting-workshop.jpg';
import { SITE } from './site';

export type Localized = {
  ar: string;
  sv: string;
};

export interface MeetingImage {
  src: ImageMetadata;
  alt: Localized;
}

export interface Meeting {
  id: string;
  date: string;
  tag: Localized;
  topic: Localized;
  summary: Localized;
  takeaway: Localized;
  adults: Localized;
  children: Localized;
  lecture: Localized;
  images: MeetingImage[];
  video: {
    url: string;
    label: Localized;
    note: Localized;
  };
}

/**
 * أضف لقاءً جديدًا في أعلى المصفوفة.
 * Add a new meeting at the top of the array.
 *
 * - date: ISO date (YYYY-MM-DD)
 * - tag: "غدًا" / "الأحد الماضي" / "اللقاء الأول"
 * - images: 2–3 صور من اللقاء (يمكن استخدام صور مؤقتة)
 * - video.url: رابط التسجيل على يوتيوب
 */
export const meetings: Meeting[] = [
  {
    id: '2026-11-08',
    date: '2026-11-08',
    tag: {
      ar: 'غدًا',
      sv: 'Imorgon',
    },
    topic: {
      ar: 'اللقاء الثالث من سلسلة المحاضرات',
      sv: 'Tredje föreläsningen i serien',
    },
    summary: {
      ar: 'نلتقي غدًا الأحد 8 نوفمبر في مكاتب ABF للقاء الثالث من سلسلة المحاضرات بالتعاون مع ABF. نبدأ الساعة 16:00، مع ضيافة وأنشطة للأطفال.',
      sv: 'Vi möts imorgon söndag 8 november i ABF-huset för den tredje föreläsningen i serien i samarbete med ABF. Vi börjar kl. 16.00 med fika och aktiviteter för barn.',
    },
    takeaway: {
      ar: 'نلتقي غدًا في ABF-huset — أهلاً بكم جميعًا.',
      sv: 'Vi ses imorgon i ABF-huset – varmt välkomna.',
    },
    adults: {
      ar: 'أنشطة وحوار حول موضوع المحاضرة.',
      sv: 'Aktiviteter och samtal kring föreläsningens tema.',
    },
    children: {
      ar: 'مساحة آمنة وألعاب وأنشطة للأطفال.',
      sv: 'Trygg plats, lekar och aktiviteter för barnen.',
    },
    lecture: {
      ar: 'اللقاء الثالث من سلسلة المحاضرات بالتعاون مع ABF. يُعلن الموضوع عبر مجموعة واتساب.',
      sv: 'Tredje föreläsningen i serien i samarbete med ABF. Temat annonseras i WhatsApp-gruppen.',
    },
    images: [
      {
        src: aboutMain,
        alt: {
          ar: 'عائلة تستمتع بوقتها معًا',
          sv: 'En familj som har roligt tillsammans',
        },
      },
      {
        src: galleryKids,
        alt: {
          ar: 'أطفال يشاركون في نشاط فني',
          sv: 'Barn som deltar i en konstaktivitet',
        },
      },
      {
        src: galleryCommunity,
        alt: {
          ar: 'عائلة تستمتع بنزهة في الحديقة',
          sv: 'En familj som har picknick i parken',
        },
      },
    ],
    video: {
      url: SITE.youtube,
      label: {
        ar: 'تُنشر التسجيلات على يوتيوب',
        sv: 'Inspelningar publiceras på YouTube',
      },
      note: {
        ar: 'سيُضاف تسجيل هذا اللقاء إلى قناة الجمعية بعد انتهائه.',
        sv: 'Inspelningen från mötet läggs upp på föreningens kanal efteråt.',
      },
    },
  },
  {
    id: '2026-11-01',
    date: '2026-11-01',
    tag: {
      ar: 'الأحد الماضي',
      sv: 'Förra söndagen',
    },
    topic: {
      ar: 'التواصل بين أفراد الأسرة',
      sv: 'Kommunikation i familjen',
    },
    summary: {
      ar: 'ناقشنا كيف نبني تواصلًا واضحًا ودافئًا بين أفراد الأسرة: الاستماع الفعّال، التعبير عن المشاعر، واختيار الوقت المناسب للحوار.',
      sv: 'Vi samtalade om hur vi bygger en tydlig och varm kommunikation i familjen: aktivt lyssnande, att uttrycka känslor och att välja rätt tid för samtal.',
    },
    takeaway: {
      ar: 'الاستماع الجيد نصف الحوار، والباقي يبدأ بسؤال بسيط: «كيف حالك حقًا؟»',
      sv: 'Att lyssna väl är halva samtalet. Resten börjar med en enkel fråga: ”Hur mår du egentligen?”',
    },
    adults: {
      ar: 'حوار مفتوح وتطبيق عملي على الاستماع الفعّال وطرح الأسئلة.',
      sv: 'Öppet samtal och praktisk övning i aktivt lyssnande och att ställa frågor.',
    },
    children: {
      ar: 'أنشطة إبداعية وألعاب تعاونية تعزز التعبير عن المشاعر.',
      sv: 'Kreativa aktiviteter och samarbetslekar som stärker förmågan att uttrycka känslor.',
    },
    lecture: {
      ar: 'محاضرة تعليمية بعنوان «التواصل بين أفراد الأسرة» بالتعاون مع ABF.',
      sv: 'Föreläsning med temat ”Kommunikation i familjen” i samarbete med ABF.',
    },
    images: [
      {
        src: aboutMain,
        alt: {
          ar: 'عائلة تستمتع بوقتها معًا',
          sv: 'En familj som har roligt tillsammans',
        },
      },
      {
        src: galleryKids,
        alt: {
          ar: 'أطفال يشاركون في نشاط فني',
          sv: 'Barn som deltar i en konstaktivitet',
        },
      },
      {
        src: galleryCommunity,
        alt: {
          ar: 'عائلة تستمتع بنزهة في الحديقة',
          sv: 'En familj som har picknick i parken',
        },
      },
    ],
    video: {
      url: SITE.youtube,
      label: {
        ar: 'شاهد التسجيلات على يوتيوب',
        sv: 'Se inspelningar på YouTube',
      },
      note: {
        ar: 'تجدون تسجيلات اللقاءات على قناة الجمعية.',
        sv: 'Du hittar inspelningar från mötena på föreningens kanal.',
      },
    },
  },
  {
    id: '2026-10-25',
    date: '2026-10-25',
    tag: {
      ar: 'اللقاء الأول',
      sv: 'Första mötet',
    },
    topic: {
      ar: 'حل النزاع بين أفراد الأسرة',
      sv: 'Konflikthantering i familjen',
    },
    summary: {
      ar: 'أول لقاء تعارف وتقديم الجمعية، تضمّن محاضرة عن حل النزاع بين أفراد الأسرة: الاستماع لكل طرف، التعبير عن المشاعر دون اتهام، والبحث عن حلول تحفظ العلاقة.',
      sv: 'Första mötet där vi presenterade föreningen och hade en föreläsning om konflikthantering i familjen: lyssna på alla parter, uttrycka känslor utan anklagelser och hitta lösningar som bevarar relationen.',
    },
    takeaway: {
      ar: 'الخلاف ليس نهاية العلاقة؛ بل فرصة لفهم أفضل واتفاق أوضح.',
      sv: 'En konflikt behöver inte betyda slutet för relationen – den kan vara en möjlighet till bättre förståelse och tydligare överenskommelser.',
    },
    adults: {
      ar: 'حوار مفتوح وورشة تطبيقية حول حل النزاع والوساطة الأسرية.',
      sv: 'Öppet samtal och praktisk workshop om konflikthantering och familjemedling.',
    },
    children: {
      ar: 'ألعاب جماعية ورسم ومسابقات في مساحة آمنة وممتعة.',
      sv: 'Grupplekar, målning och tävlingar i en trygg och rolig miljö.',
    },
    lecture: {
      ar: 'محاضرة تعليمية بعنوان «حل النزاع بين أفراد الأسرة» بالتعاون مع ABF.',
      sv: 'Föreläsning med temat ”Konflikthantering i familjen” i samarbete med ABF.',
    },
    images: [
      {
        src: meetingDialogue,
        alt: {
          ar: 'عائلة تتحدث وتضحك معًا في المنزل',
          sv: 'En familj som pratar och skrattar tillsammans hemma',
        },
      },
      {
        src: meetingWorkshop,
        alt: {
          ar: 'ورشة عمل للكبار في لقاء الجمعية',
          sv: 'En workshop för vuxna på föreningens möte',
        },
      },
      {
        src: galleryDinner,
        alt: {
          ar: 'عائلة تتناول الطعام معًا',
          sv: 'En familj som äter tillsammans',
        },
      },
    ],
    video: {
      url: SITE.youtube,
      label: {
        ar: 'شاهد التسجيلات على يوتيوب',
        sv: 'Se inspelningar på YouTube',
      },
      note: {
        ar: 'تجدون تسجيلات اللقاءات على قناة الجمعية.',
        sv: 'Du hittar inspelningar från mötena på föreningens kanal.',
      },
    },
  },
];

export const latestMeetings = [...meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
