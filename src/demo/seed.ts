/**
 * Fictional demo dataset. Every person, phone number, project and amount here is invented —
 * nothing comes from the production database. Dates are relative to "now" so the demo always
 * looks freshly used.
 */
import type { Json } from '@/lib/database.types';
import type { FormField, FormStyle } from '@/lib/types';
import type { DemoDb } from './db';

export const DEMO_IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  editor: '00000000-0000-4000-8000-000000000002',
  viewer: '00000000-0000-4000-8000-000000000003',
  editor2: '00000000-0000-4000-8000-000000000004',
};

/* ---------- helpers ---------- */

// Deterministic PRNG so a reset always yields the same dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

const uuid = () => crypto.randomUUID();

/* ---------- people (fictional) ---------- */

const CHILD_FIRST = ['Марія', 'Іван', 'Софія', 'Андрій', 'Анна', 'Максим', 'Вікторія', 'Дмитро', 'Олександра', 'Артем', 'Катерина', 'Назар', 'Ярослава', 'Матвій', 'Діана', 'Остап', 'Злата', 'Тимофій', 'Емілія', 'Роман'];
const SURNAMES = ['Ковальчук', 'Шевчук', 'Бондар', 'Ткачук', 'Кравець', 'Олійник', 'Мельничук', 'Савчук', 'Руденко', 'Гнатюк', 'Поліщук', 'Лисенко', 'Марченко', 'Ковач', 'Химинець', 'Попович', 'Фединець', 'Тягур'];
const PARENT_FIRST = ['Наталія', 'Оксана', 'Тетяна', 'Ірина', 'Василь', 'Михайло', 'Юлія', 'Світлана', 'Петро', 'Галина'];

/* ---------- forms ---------- */

const f = (id: string, type: FormField['type'], label: string, required: boolean, extra: Partial<FormField> = {}): FormField => ({
  id, type, label, required, ...extra,
});

const campFields: FormField[] = [
  f('child_name', 'text', 'ПІБ дитини', true, { placeholder: 'Прізвище, імʼя, по батькові' }),
  f('birth_date', 'date', 'Дата народження', true),
  f('parent_name', 'text', 'Імʼя одного з батьків', true),
  f('phone', 'phone', 'Телефон для звʼязку', true, { placeholder: '+380…' }),
  f('email', 'email', 'Електронна пошта', false),
  f('shift', 'radio', 'Зміна', true, { options: ['I зміна · 1–10 липня', 'II зміна · 14–23 липня', 'III зміна · 28 липня – 6 серпня'] }),
  f('tshirt', 'select', 'Розмір футболки', true, { options: ['XS', 'S', 'M', 'L', 'XL'] }),
  f('interests', 'checkbox', 'Що найбільше цікавить?', false, { options: ['Спорт', 'Походи', 'Творчість', 'Англійська', 'Робототехніка'] }),
  f('health', 'textarea', 'Алергії чи особливості здоровʼя', false, { placeholder: 'Якщо немає — залиште порожнім' }),
  f('medical', 'file', 'Медична довідка (фото або PDF)', false),
];

const florballFields: FormField[] = [
  f('name', 'text', 'Імʼя та прізвище', true),
  f('age', 'number', 'Вік', true),
  f('location', 'select', 'Де зручніше тренуватися?', true, { options: ['Свалява', 'с. Поляна'] }),
  f('experience', 'radio', 'Досвід у флорболі', true, { options: ['Ніколи не грав(ла)', 'Пробував(ла) кілька разів', 'Граю регулярно'] }),
  f('phone', 'phone', 'Телефон батьків', true),
];

const volunteerFields: FormField[] = [
  f('name', 'text', 'Імʼя та прізвище', true),
  f('email', 'email', 'Електронна пошта', true),
  f('phone', 'phone', 'Телефон', false),
  f('directions', 'checkbox', 'Чим хочете допомагати?', true, { options: ['Табори', 'Спортивні тренування', 'Фото та відео', 'Соцмережі', 'Логістика заходів'] }),
  f('hours', 'select', 'Скільки годин на тиждень?', true, { options: ['1–3', '4–8', '8+'] }),
  f('motivation', 'textarea', 'Чому хочете долучитися?', false),
];

const feedbackFields: FormField[] = [
  f('workshop', 'select', 'Який майстер-клас відвідали?', true, { options: ['Кераміка', 'Фотографія', 'Ораторське мистецтво'] }),
  f('rating', 'radio', 'Оцінка', true, { options: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'] }),
  f('comment', 'textarea', 'Що сподобалося і що покращити?', false),
];

const style = (s: Partial<FormStyle>): Json => ({ accentColor: '#01B5B4', showLogo: true, attachments: [], ...s }) as unknown as Json;

/* ---------- submissions ---------- */

function buildSubmissions(formIds: { camp: string; florball: string; volunteer: string }) {
  const rand = mulberry32(2027);
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)]!;
  const phone = () => `+38 (0${pick(['50', '66', '67', '68', '96', '97', '99'])}) ${String(Math.floor(rand() * 900) + 100)}-${String(Math.floor(rand() * 90) + 10)}-${String(Math.floor(rand() * 90) + 10)}`;
  const translit: Record<string, string> = { Марія: 'maria', Іван: 'ivan', Софія: 'sofia', Наталія: 'natalia', Оксана: 'oksana', Тетяна: 'tetiana', Ірина: 'iryna', Василь: 'vasyl', Михайло: 'mykhailo', Юлія: 'yulia', Світлана: 'svitlana', Петро: 'petro', Галина: 'halyna' };
  const mail = (first: string) => `${translit[first] ?? 'user'}${Math.floor(rand() * 90) + 10}@example.com`;
  const rows: Array<{ id: string; form_id: string; data: Json; submitted_at: string }> = [];

  for (let i = 0; i < 23; i++) {
    const surname = pick(SURNAMES);
    const parent = pick(PARENT_FIRST);
    const year = 2012 + Math.floor(rand() * 7);
    const interests = ['Спорт', 'Походи', 'Творчість', 'Англійська', 'Робототехніка'].filter(() => rand() > 0.55);
    rows.push({
      id: uuid(),
      form_id: formIds.camp,
      submitted_at: ago(Math.floor(rand() * 26), Math.floor(rand() * 20)),
      data: {
        child_name: `${surname} ${pick(CHILD_FIRST)}`,
        birth_date: `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`,
        parent_name: `${parent} ${surname}`,
        phone: phone(),
        email: rand() > 0.3 ? mail(parent) : '',
        shift: pick(campFields[5]!.options!),
        tshirt: pick(['XS', 'S', 'S', 'M', 'M', 'L']),
        interests: interests.length ? interests : ['Спорт'],
        health: rand() > 0.75 ? pick(['Алергія на цитрусові', 'Непереносимість лактози', 'Астма, має інгалятор', 'Алергія на укуси бджіл']) : '',
        medical: rand() > 0.5 ? { file: `${formIds.camp}/${uuid()}/medical-certificate.svg`, name: `dovidka-${surname.toLowerCase()}.jpg` } : null,
      },
    });
  }

  for (let i = 0; i < 11; i++) {
    rows.push({
      id: uuid(),
      form_id: formIds.florball,
      submitted_at: ago(Math.floor(rand() * 40), Math.floor(rand() * 20)),
      data: {
        name: `${pick(CHILD_FIRST)} ${pick(SURNAMES)}`,
        age: String(8 + Math.floor(rand() * 10)),
        location: pick(['Свалява', 'Свалява', 'с. Поляна']),
        experience: pick(florballFields[3]!.options!),
        phone: phone(),
      },
    });
  }

  const motivations = [
    'Сам колись ходив у табір і хочу повернути це добро дітям.',
    'Маю досвід SMM, можу допомогти з Instagram.',
    'Хочу бути корисною громаді, люблю працювати з дітьми.',
    'Займаюся фотографією, готовий знімати заходи.',
    '',
  ];
  for (let i = 0; i < 7; i++) {
    const first = pick(PARENT_FIRST);
    rows.push({
      id: uuid(),
      form_id: formIds.volunteer,
      submitted_at: ago(Math.floor(rand() * 60), Math.floor(rand() * 20)),
      data: {
        name: `${first} ${pick(SURNAMES)}`,
        email: mail(first),
        phone: rand() > 0.4 ? phone() : '',
        directions: ['Табори', 'Спортивні тренування', 'Фото та відео', 'Соцмережі', 'Логістика заходів'].filter(() => rand() > 0.6).concat(['Табори']).filter((v, idx, a) => a.indexOf(v) === idx),
        hours: pick(['1–3', '4–8', '8+']),
        motivation: pick(motivations),
      },
    });
  }
  return rows;
}

/* ---------- quizzes ---------- */

type Q = [text: string, options: string[], correct: number[], seconds?: number, points?: number];

function questions(quizId: string, items: Q[]) {
  return items.map(([question_text, options, correct_indexes, time_limit_seconds = 20, points = 1000], position) => ({
    id: uuid(), quiz_id: quizId, question_text, options: options as Json, correct_indexes, time_limit_seconds, points, position,
  }));
}

/* ---------- projects ---------- */

const PRESET = ['200 грн', '500 грн', '1 000 грн', '2 000 грн'];

function presentation(p: {
  color: string; emoji: string; details: Array<[string, string]>; title: string; btn: string; note: string;
}): Json {
  return {
    color_class: p.color,
    gradient_emoji: p.emoji,
    popup_details: p.details,
    preset_amounts: PRESET,
    preset_active_idx: 1,
    donate_title: p.title,
    donate_btn: p.btn,
    donate_note: p.note,
    success: { emoji: '🎉', title: 'Дякуємо за підтримку!', text: 'Ваш внесок змінює життя дітей громади' },
  };
}

/* ---------- assemble ---------- */

export function buildSeed(): DemoDb {
  const form = { camp: uuid(), florball: uuid(), volunteer: uuid(), feedback: uuid() };
  const quiz = { carpathians: uuid(), science: uuid(), english: uuid() };

  return {
    profiles: [
      { id: DEMO_IDS.admin, full_name: 'Олена Демченко', email: 'admin@demo.wise-step.org', role: 'super_admin', created_at: ago(220) },
      { id: DEMO_IDS.editor, full_name: 'Андрій Мельник', email: 'editor@demo.wise-step.org', role: 'editor', created_at: ago(180) },
      { id: DEMO_IDS.editor2, full_name: 'Христина Попович', email: 'khrystyna@demo.wise-step.org', role: 'editor', created_at: ago(95) },
      { id: DEMO_IDS.viewer, full_name: 'Ігор Савчук', email: 'viewer@demo.wise-step.org', role: 'viewer', created_at: ago(40) },
    ],

    forms: [
      {
        id: form.camp, title: 'Реєстрація в літній табір «Карпатська хвиля» 2027', slug: 'camp-2027', is_published: true,
        schema: { fields: campFields } as unknown as Json,
        style: style({
          description: 'Три зміни по 10 днів у Карпатах: походи, спорт, творчі майстерні та англійська з волонтерами. Для дітей 8–15 років.',
          coverImage: '/demo/form-camp-cover.svg',
          attachments: [{ id: uuid(), url: '/demo/camp-rules.pdf', name: 'Правила табору 2027.pdf', size: 837 }] as never,
        }),
        created_by: DEMO_IDS.admin, created_at: ago(30), updated_at: ago(2),
      },
      {
        id: form.florball, title: 'Запис до флорбольної секції', slug: 'florball-signup', is_published: true,
        schema: { fields: florballFields } as unknown as Json,
        style: style({ accentColor: '#152837', description: 'Безкоштовні тренування для дітей та підлітків 8–17 років.' }),
        created_by: DEMO_IDS.editor, created_at: ago(45), updated_at: ago(12),
      },
      {
        id: form.volunteer, title: 'Анкета волонтера', slug: 'volunteer', is_published: true,
        schema: { fields: volunteerFields } as unknown as Json,
        style: style({ accentColor: '#F2B705', description: 'Долучайтеся до команди — допомога потрібна в таборах, на тренуваннях і в медіа.' }),
        created_by: DEMO_IDS.editor2, created_at: ago(70), updated_at: ago(20),
      },
      {
        id: form.feedback, title: 'Відгук про майстер-клас', slug: 'workshop-feedback', is_published: false,
        schema: { fields: feedbackFields } as unknown as Json,
        style: style({}),
        created_by: DEMO_IDS.editor, created_at: ago(3), updated_at: ago(1),
      },
    ],

    form_submissions: buildSubmissions(form),

    quizzes: [
      { id: quiz.carpathians, title: 'Знавці Закарпаття', cover_image: '/demo/quiz-carpathians.svg', created_by: DEMO_IDS.admin, created_at: ago(14) },
      { id: quiz.science, title: 'Цікава наука', cover_image: '/demo/quiz-science.svg', created_by: DEMO_IDS.editor, created_at: ago(9) },
      { id: quiz.english, title: 'English Starter', cover_image: '/demo/quiz-english.svg', created_by: DEMO_IDS.editor2, created_at: ago(4) },
    ],

    quiz_questions: [
      ...questions(quiz.carpathians, [
        ['Яка найвища гора України?', ['Говерла', 'Петрос', 'Піп Іван', 'Бребенескул'], [0]],
        ['Через яке місто протікає річка Латориця?', ['Ужгород', 'Свалява', 'Хуст', 'Рахів'], [1]],
        ['Які з цих тварин живуть у Карпатах?', ['Бурий ведмідь', 'Рись', 'Кенгуру', 'Благородний олень'], [0, 1, 3], 25],
        ['Як називається гуцульський музичний інструмент завдовжки до 4 метрів?', ['Сопілка', 'Трембіта', 'Цимбали', 'Дримба'], [1], 15],
        ['Яке озеро називають «Морським оком» Карпат?', ['Синевир', 'Несамовите', 'Бребенескул', 'Марічейка'], [0]],
        ['Скільки областей України охоплюють Карпати?', ['2', '3', '4', '5'], [2], 15, 1500],
      ]),
      ...questions(quiz.science, [
        ['Яка планета найближча до Сонця?', ['Венера', 'Меркурій', 'Марс', 'Земля'], [1], 15],
        ['Що з переліченого — ссавці?', ['Дельфін', 'Кажан', 'Акула', 'Кит'], [0, 1, 3], 25],
        ['При якій температурі кипить вода на рівні моря?', ['90 °C', '100 °C', '110 °C', '120 °C'], [1], 15],
        ['Хто винайшов телефон?', ['Едісон', 'Тесла', 'Белл', 'Попов'], [2]],
        ['Скільки кісток у тілі дорослої людини?', ['186', '206', '226', '256'], [1], 20, 1500],
      ]),
      ...questions(quiz.english, [
        ['How do you say «яблуко» in English?', ['Orange', 'Apple', 'Pear', 'Plum'], [1], 15],
        ['Choose the colours:', ['Red', 'Table', 'Blue', 'Green'], [0, 2, 3], 20],
        ['«I ___ a student.»', ['is', 'are', 'am', 'be'], [2], 15],
        ['What is the plural of «child»?', ['Childs', 'Children', 'Childes', 'Childrens'], [1]],
        ['Which word is a day of the week?', ['March', 'Summer', 'Friday', 'Morning'], [2], 15],
      ]),
    ],

    game_sessions: [],
    game_players: [],
    game_answers: [],

    projects: [
      {
        id: uuid(), slug: 'florball-demo', sort_order: 1, title: 'Юні флорболісти', category: 'Спорт', icon: '🏒',
        badge: 'Спорт · Постійний проєкт', short_description: 'Безкоштовні тренування з флорболу для дітей 8–17 років у Сваляві та Поляні.',
        full_description: 'Флорбол — динамічна командна гра, що вчить дисципліни, взаємопідтримки та чесної гри. Тренування тричі на тиждень, участь в обласних турнірах і дружні матчі з командами сусідніх громад.',
        read_more: null, cover_image: '/demo/project-florball.svg', main_image_alt: 'Діти грають у флорбол',
        gallery: ['/demo/gallery-1.svg', '/demo/gallery-2.svg', '/demo/gallery-3.svg'] as Json, tags: ['Флорбол', 'Свалява', 'Тренування'],
        status: 'ongoing', lifecycle: 'active', featured: true, published: true,
        is_fundraiser: false, goal_amount: null, current_amount: null, donors_count: null, progress_visible: false,
        progress_percent: null, amount_left: null, deadline_days: null, currency: 'грн',
        external_donate_url: 'https://donate.example.org/wise-step-demo/florball',
        presentation: presentation({ color: 'g-teal', emoji: '🏑🥅', details: [['📍 Локація', 'Свалява та с. Поляна'], ['📅 Частота', '3 тренування на тиждень'], ['👥 Учасники', '35 дітей у 3 командах']], title: '💛 Підтримати флорбольні команди', btn: '💛 Задонатити на флорбол', note: 'Кошти підуть на ключки, форму та поїздки на турніри' }),
        created_by: DEMO_IDS.admin, created_at: ago(200), updated_at: ago(6),
      },
      {
        id: uuid(), slug: 'camp-2027-demo', sort_order: 2, title: 'Табір «Карпатська хвиля» 2027', category: 'Табори', icon: '🏕️',
        badge: 'Збір коштів', short_description: 'Збираємо на 30 путівок для дітей з родин ВПО та малозабезпечених сімей.',
        full_description: 'Десять днів у горах: походи, вогнища, спорт, творчі майстерні та англійська з іноземними волонтерами. Одна путівка — 4 000 грн, включно з проживанням, харчуванням і страховкою.',
        read_more: null, cover_image: '/demo/project-camp.svg', main_image_alt: 'Табір у горах',
        gallery: ['/demo/gallery-4.svg', '/demo/gallery-5.svg'] as Json, tags: ['Табір', 'Карпати', 'ВПО'],
        status: 'campaign', lifecycle: 'active', featured: true, published: true,
        is_fundraiser: true, goal_amount: 120000, current_amount: 78400, donors_count: 214, progress_visible: true,
        progress_percent: 65, amount_left: 41600, deadline_days: 48, currency: 'грн',
        external_donate_url: 'https://donate.example.org/wise-step-demo/camp',
        presentation: presentation({ color: 'g-green', emoji: '⛺🌲', details: [['📅 Дати', 'Липень–серпень 2027'], ['👦 Вік', '8–15 років'], ['🎯 Мета', '30 путівок'], ['💰 Путівка', '4 000 грн']], title: '🏕️ Подаруйте дитині літо в горах', btn: '💛 Оплатити путівку', note: 'Звіт про кожну гривню — у нашому Instagram' }),
        created_by: DEMO_IDS.admin, created_at: ago(60), updated_at: ago(1),
      },
      {
        id: uuid(), slug: 'robotics-demo', sort_order: 3, title: 'Майстерня робототехніки', category: 'Освіта', icon: '🤖',
        badge: 'Незабаром', short_description: 'Відкриваємо гурток робототехніки та програмування для підлітків.',
        full_description: 'Плануємо закупити 8 навчальних наборів Arduino та 4 ноутбуки, щоб підлітки громади вчилися програмувати, паяти й створювати власних роботів під наглядом інженерів-волонтерів.',
        read_more: null, cover_image: '/demo/project-robotics.svg', main_image_alt: 'Набори для робототехніки',
        gallery: [] as Json, tags: ['STEM', 'Програмування'],
        status: 'campaign', lifecycle: 'upcoming', featured: false, published: true,
        is_fundraiser: true, goal_amount: 45000, current_amount: 12800, donors_count: 37, progress_visible: true,
        progress_percent: 28, amount_left: 32200, deadline_days: 90, currency: 'грн',
        external_donate_url: 'https://donate.example.org/wise-step-demo/robotics',
        presentation: presentation({ color: 'g-blue', emoji: '🤖⚙️', details: [['🧑‍💻 Вік', '12–17 років'], ['📦 Потреба', '8 наборів Arduino, 4 ноутбуки']], title: '🤖 Допоможіть запустити гурток', btn: '💛 Підтримати STEM', note: 'Кошти підуть на обладнання' }),
        created_by: DEMO_IDS.editor, created_at: ago(25), updated_at: ago(3),
      },
      {
        id: uuid(), slug: 'theatre-demo', sort_order: 4, title: 'Театральна студія «Маска»', category: 'Творчість', icon: '🎭',
        badge: 'Творчість · Постійний проєкт', short_description: 'Акторська майстерність, сценічна мова та власні вистави для дітей 10–16 років.',
        full_description: 'Студія працює щосуботи. За рік діти поставили дві вистави та виступили на фестивалі шкільних театрів в Ужгороді.',
        read_more: null, cover_image: '/demo/project-theatre.svg', main_image_alt: 'Театральна вистава',
        gallery: ['/demo/gallery-6.svg'] as Json, tags: ['Театр', 'Творчість'],
        status: 'ongoing', lifecycle: 'active', featured: false, published: true,
        is_fundraiser: false, goal_amount: null, current_amount: null, donors_count: null, progress_visible: false,
        progress_percent: null, amount_left: null, deadline_days: null, currency: 'грн',
        external_donate_url: 'https://donate.example.org/wise-step-demo/theatre',
        presentation: presentation({ color: 'g-purple', emoji: '🎭✨', details: [['📅 Заняття', 'Щосуботи, 11:00'], ['👥 Учасники', '18 дітей']], title: '🎭 Підтримати студію', btn: '💛 Задонатити', note: 'На костюми та декорації' }),
        created_by: DEMO_IDS.editor2, created_at: ago(150), updated_at: ago(30),
      },
      {
        id: uuid(), slug: 'gifts-demo', sort_order: 5, title: 'Миколай для кожного', category: 'Благодійність', icon: '🎁',
        badge: 'Разова акція', short_description: 'Новорічні подарунки для 150 дітей з родин переселенців.',
        full_description: 'Щороку до Дня святого Миколая збираємо подарунки: солодощі, книжки та теплі речі. Минулого року подарунки отримали 120 дітей.',
        read_more: null, cover_image: '/demo/project-gifts.svg', main_image_alt: 'Подарунки',
        gallery: [] as Json, tags: ['Свята', 'ВПО'],
        status: 'one_time', lifecycle: 'upcoming', featured: false, published: true,
        is_fundraiser: true, goal_amount: 60000, current_amount: 51250, donors_count: 168, progress_visible: true,
        progress_percent: 85, amount_left: 8750, deadline_days: 52, currency: 'грн',
        external_donate_url: 'https://donate.example.org/wise-step-demo/gifts',
        presentation: presentation({ color: 'g-orange', emoji: '🎁🎄', details: [['🎯 Мета', '150 подарунків'], ['📅 Вручення', '6 грудня']], title: '🎁 Стати Миколаєм', btn: '💛 Купити подарунок', note: 'Один подарунок — 400 грн' }),
        created_by: DEMO_IDS.admin, created_at: ago(18), updated_at: ago(2),
      },
      {
        id: uuid(), slug: 'boardgames-demo', sort_order: 6, title: 'Клуб настільних ігор', category: 'Дозвілля', icon: '🎲',
        badge: null, short_description: 'Щотижневі вечори настільних ігор для підлітків.',
        full_description: null, read_more: null, cover_image: null, main_image_alt: null,
        gallery: [] as Json, tags: ['Дозвілля'],
        status: 'ongoing', lifecycle: null, featured: false, published: false,
        is_fundraiser: false, goal_amount: null, current_amount: null, donors_count: null, progress_visible: false,
        progress_percent: null, amount_left: null, deadline_days: null, currency: 'грн',
        external_donate_url: null, presentation: {} as Json,
        created_by: DEMO_IDS.editor, created_at: ago(2), updated_at: ago(2),
      },
    ],
  };
}
