-- WiseStep Admin — replace demo projects with the live wise-step.org projects
--
-- Supersedes the 3 placeholder rows from 00003_seed.sql with the 11 real
-- projects currently shown on wise-step.org. All text was transcribed verbatim
-- from the live site on 2026-07-07 (static project cards + the client-side
-- POPUP_DATA object), NOT invented.
--
-- Field model matches 00004_projects_public_sync.sql: display-critical fields
-- are columns; popup-only presentation lives in the `presentation` jsonb blob.
--
-- Data notes preserved from source (nothing resolved by guessing):
--   * All donate buttons share one Monobank jar — there are no per-project links.
--   * `progress_visible` reflects the LIVE card: several projects carry progress
--     numbers in source that are commented out / not shown (cup2026, candles) —
--     their bars stay hidden but the numbers are retained for reference. camps
--     and camp show their bars live.
--   * cup2026 CONFLICT: the card progress says goal 30 000 грн (raised 18 400 =
--     61%), while the popup detail row says "~50 000 грн". We store 30 000 as the
--     numeric goal_amount (internally consistent with raised/percent) and keep the
--     "~50 000 грн" popup string verbatim in presentation.popup_details. Unresolved.

-- ---------------------------------------------------------------------------
-- Remove the demo seed rows (00003_seed.sql). Idempotent — matched by title.
-- ---------------------------------------------------------------------------
delete from public.projects
where title in (
  'Флорбольний клуб',
  'Літній табір у Карпатах 2026',
  'Творчі майстерні'
);

-- ---------------------------------------------------------------------------
-- Insert the 11 live projects (ordered by their position on the site).
-- Re-runnable: on slug conflict, refresh the row from source.
-- ---------------------------------------------------------------------------
insert into public.projects (
  slug, sort_order, title, category, icon, badge,
  short_description, full_description,
  cover_image, main_image_alt, gallery, tags,
  status, lifecycle, featured,
  is_fundraiser, goal_amount, current_amount, donors_count,
  progress_percent, amount_left, deadline_days, progress_visible,
  currency, external_donate_url, presentation
) values

-- 1 · Флорбольні команди (featured, ongoing)
(
  'florball', 1, 'Флорбольні команди', 'Спорт', '🏒', 'Спорт · Постійний проєкт',
  'Тренування у Сваляві та с. Поляна. Тренування, командний дух, розвиток фізичних якостей.',
  'Флорбол — це командний вид спорту, який розвиває не лише фізичні якості, але й командний дух, дисципліну та відповідальність. Wise Step веде флорбольні клуби у Сваляві та с. Поляна.',
  '/photos/Floorbal (main).webp', 'Флорбольні команди',
  '["/photos/Sports 3.webp","/photos/Floorball.webp","/photos/Floorball 1.webp"]'::jsonb,
  array['Флорбол','Свалява','с. Поляна','Тренування']::text[],
  'ongoing', 'active', true,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-teal","gradient_emoji":"🏑🥅","popup_details":[["📍 Локація","Свалява та с. Поляна"],["📅 Частота","Тренування 2-3 рази/тиждень"],["👥 Учасники","Діти та молодь 8–22 роки"],["🏆 Результат","20+ учасників у командах"]],"preset_amounts":["200 грн","500 грн","1 000 грн","2 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати флорбольні команди","donate_btn":"💛 Задонатити на флорбол","donate_note":"Кошти підуть на: інвентар, оренду залу, участь у змаганнях","success":{"emoji":"🎉","title":"Дякуємо за підтримку!","text":"Ваш внесок допомагає дітям розвиватися через спорт"},"cta_details_action":"openPopup(''florball'')"}'::jsonb
),

-- 2 · Кубок Карпат 2026 (campaign, upcoming — card progress commented out on live site)
(
  'cup2026', 2, 'Кубок Карпат 2026', 'Змагання', '🏆', 'Змагання · Збір коштів',
  'Організація регіонального турніру з флорболу восени 2026. Потрібно покрити витрати на оренду залу, інвентар та нагороди.',
  'Кубок Карпат — регіональний турнір з флорболу, який Wise Step організовує щороку. У 2026 році ми плануємо зібрати 15+ команд із Закарпаття та сусідніх областей. Потрібна ваша допомога для покриття організаційних витрат!',
  '/photos/Cup (main).webp', 'Кубок Карпат 2026',
  '["/photos/Cup.webp","/photos/Cup 1.webp","/photos/Cup 2.webp","/photos/Cup 3.webp"]'::jsonb,
  array['Флорбол','Свалява','с. Поляна']::text[],
  'campaign', 'upcoming', false,
  true, 30000, 18400, 34, 61, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-warm","gradient_emoji":"🏆","popup_details":[["📅 Дата","Травень 2026"],["🏟️ Місце","м. Свалява"],["👥 Команди","15+ команд із регіону"],["🎯 Мета збору","~50 000 грн"]],"preset_amounts":["300 грн","700 грн","1 500 грн","3 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати Кубок Карпат 2026","donate_btn":"🏆 Підтримати турнір","donate_note":"Кошти: оренда залу, нагороди, інвентар","success":{"emoji":"🏆","title":"Ви підтримали Кубок Карпат!","text":"Завдяки вам відбудуться чудові змагання"},"cta_details_action":"openPopup(''cup2026'')"}'::jsonb
),

-- 3 · Творчі майстерні та рукоділля (ongoing)
(
  'crafts', 3, 'Творчі майстерні та рукоділля', 'Творчість', '🎨', 'Творчість · Постійний',
  'Майстерні для дітей і молоді — від рукоділля до виготовлення гіпсових виробів і декору.',
  'Творчі майстерні — це простір, де діти і молодь можуть виражати себе через мистецтво. Ми проводимо заняття з рукоділля, розпису, виготовлення гіпсових виробів, декупажу та інших видів творчості.',
  '/photos/Crafts (main).webp', 'Творчі майстерні',
  '["/photos/Crafts 1.webp","/photos/Crafts 2.webp","/photos/Crafts 3.webp"]'::jsonb,
  array['Рукоділля','Творчість']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-pink","gradient_emoji":"🎨","popup_details":[["📅 Частота","Щопонеділка о 18:00"],["👥 Вік","6–18 років"],["🎨 Напрямки","Рукоділля, розпис, декор"],["💰 Участь","Безкоштовно"]],"preset_amounts":["150 грн","400 грн","800 грн","2 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати творчі майстерні","donate_btn":"🎨 Підтримати майстерні","donate_note":"Кошти підуть на: матеріали, фарби, інструменти для занять","success":{"emoji":"🎨","title":"Дякуємо за підтримку!","text":"Ваш внесок розвиває творчий потенціал дітей"},"cta_details_action":"openPopup(''crafts'')"}'::jsonb
),

-- 4 · Окопні свічки для військових (ongoing; progress present but commented out on live site)
(
  'candles', 4, 'Окопні свічки для військових', 'Соціальний', '🕯️', 'Соціальний · Постійний',
  'Збираємо на матеріали для виготовлення окопних свічок для захисників України. Молодь виготовляє вручну.',
  'Наша команда разом із молоддю виготовляє окопні свічки для українських військових і регулярно передає їх на передову. Збір спрямований на матеріали та підтримку безперервного виробництва, щоб допомога надходила стабільно.',
  '/photos/Candles (main).webp', 'Окопні свічки',
  '["/photos/Candles 1.webp","/photos/Candles 2.webp","/photos/Candles 3.webp","/photos/Candles (main).webp"]'::jsonb,
  array['Підтримка','Разом до Перемоги']::text[],
  'ongoing', 'active', false,
  true, 8000, 7200, 52, 90, 800, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-olive","gradient_emoji":"","popup_details":[["🎯 Мета","Безперервне виготовлення та передача окопних свічок для військових"],["💰 Сума збору","Відкритий збір на матеріали та виробництво"],["👥 Волонтери","15+ молодих людей"],["🎖️ Для кого","Захисники України"]],"preset_amounts":["100 грн","300 грн","500 грн","800 грн"],"preset_active_idx":1,"donate_title":"💛 Допоможи завершити збір!","donate_btn":"🕯️ Підтримати збір свічок","donate_note":"Ваш внесок — це тепло для наших героїв","success":{"emoji":"🕯️","title":"Дякуємо за підтримку!","text":"Ваш внесок — це світло і тепло для захисників"},"cta_details_action":"openPopup(''candles'')"}'::jsonb
),

-- 5 · Робота з дітьми реб-центру (ongoing)
(
  'reb', 5, 'Робота з дітьми реб-центру', 'Реабілітація', '🤝', 'Реабілітація · Постійний',
  'Психологічна підтримка та дозвілля для дітей і молоді з центрів реабілітації. Щотижневі зустрічі та заняття.',
  'Wise Step співпрацює з реабілітаційними центрами Закарпаття. Наші волонтери та лідери регулярно відвідують дітей і молодь, організовуючи для них ігри, творчі заняття, спортивні активності та духовну підтримку.',
  '/photos/Reb center (main).webp', 'РЕБ центр',
  '["/photos/Reb center 1.webp","/photos/Reb center 2.webp","/photos/Reb center 3.webp","/photos/Reb center (main).webp"]'::jsonb,
  array['Підтримка','Реабілітація']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-blue","gradient_emoji":"🤝","popup_details":[["📅 Частота","Раз на 2 тижні"],["👥 Охоплення","30+ дітей"],["🌟 Формати","Ігри, спорт, творчість"],["💙 Підхід","Психологічна підтримка"]],"preset_amounts":["200 грн","500 грн","1 000 грн","3 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати роботу з дітьми реб-центру","donate_btn":"🤝 Підтримати цей проєкт","donate_note":"Кошти: матеріали для занять, транспорт, подарунки для дітей","success":{"emoji":"🤝","title":"Дякуємо за підтримку!","text":"Ви дарите надію дітям, які цього потребують"},"cta_details_action":"openPopup(''reb'')"}'::jsonb
),

-- 6 · Денні літні табори Wise Step 2026 (campaign, upcoming — progress visible live)
(
  'camps', 6, 'Денні літні табори Wise Step 2026', 'Денні табори', '🚴', 'Денні табори · Збір коштів',
  'Збираємо на проведення 4-ох денніх таборів, які тривають 4 дні для 20 дітей в кожному з них.',
  'Щорічні літні табори — одні з найулюбленіших програм Wise Step. 4 насичених таборів серед природи Карпат, де діти знаходять нових друзями, дізнаються про Бога, займаються спортом і розвивають таланти.',
  '/photos/Camps (main).webp', 'Денні табори',
  '["/photos/Camps 4.webp","/photos/Camps 1.webp","/photos/Camps 2.webp","/photos/Camps 3.webp"]'::jsonb,
  array[]::text[],
  'campaign', 'upcoming', false,
  true, 55000, 10500, 2, 19, 44500, 90, true,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-yellow","gradient_emoji":"🚴","popup_details":[["📅 Дати","Липень 2026, 4 дні"],["👥 Учасники","20 дітей (12–16 р.)"],["📍 Місце","Карпати, м. Свалява"],["💰 Мета збору","55 000 грн"]],"preset_amounts":["500 грн","1 000 грн","2 500 грн","5 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати денні літні табори","donate_btn":"🚴 Підтримати табір","donate_note":"Інвестиція у розвиток майбутнього покоління.","success":{"emoji":"🚴","title":"Дякуємо за підтримку!","text":"Ви допомагаєте дітям провести незабутнє літо"},"cta_details_action":"openPopup(''camps'')"}'::jsonb
),

-- 7 · Літній табір "Summer Wise Camp 2026" (campaign, upcoming — bar visible, amount text commented out)
(
  'camp', 7, 'Літній табір "Summer Wise Camp 2026"', 'Табір', '⛺', 'Табір · Збір коштів',
  'Збираємо на проведення 5-денного літнього табору для 30 дітей. Допоможемо дітям із вразливих сімей брати участь безкоштовно.',
  'Щорічний літній табір — одна з найулюбленіших програм Wise Step. 5 насичених днів серед природи Карпат, де діти знаходять нових друзів, дізнаються про Бога, займаються спортом і розвивають таланти.',
  '/photos/Summer Camp (main).webp', 'Літній табір',
  '["/photos/Summer Camp 1.webp","/photos/Summer Camp 2.webp","/photos/Summer Camp 3.webp","/photos/Summer Camp 4.webp","/photos/Summer Camp 5.webp","/photos/Summer Camp 6.webp"]'::jsonb,
  array[]::text[],
  'campaign', 'upcoming', false,
  true, 87500, 17500, 3, 20, 70000, 135, true,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-orange","gradient_emoji":"","popup_details":[["📅 Дата","Серпень 2026, 5 днів"],["👥 Учасники","30 дітей (13–16 р.)"],["📍 Місце","Карпати, с. Жденієво"],["💰 Мета збору","87 500 грн"]],"preset_amounts":["500 грн","1 000 грн","2 500 грн","5 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати літній табір","donate_btn":"⛺ Підтримати табір","donate_note":"1 000 грн = один безкоштовний день для дитини з вразливої сім''ї","success":{"emoji":"⛺","title":"Дякуємо за підтримку!","text":"Ви допомагаєте дітям провести незабутнє літо"},"cta_details_action":"openPopup(''camp'')"}'::jsonb
),

-- 8 · Настільний клуб (ongoing)
(
  'games', 8, 'Настільний клуб', 'Настолки', '🎲', 'Настолки · Постійний',
  'Настільні ігри та розваги для дітей і молоді — розвиваємо стратегічне мислення, комунікацію та весело проводимо час разом.',
  'Настільний клуб — це місце, де можна відпочити, познайомитися з новими людьми і весело провести час. Ми організовуємо регулярні ігрові вечори.',
  '/photos/Games (main).webp', 'Настільний клуб',
  '["/photos/Games (main).webp","/photos/Games 1.webp","/photos/Games 2.webp"]'::jsonb,
  array['Настолки','Розваги']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-purple","gradient_emoji":"🎲","popup_details":[["📅 Частота","Щотижня по суботах"],["🎲 Ігри","10 + різних настольних ігор"],["👥 Вік","Для всіх!"],["🎉 Заходи","Розваги, Ігри"]],"preset_amounts":["200 грн","500 грн","1 000 грн","2 500 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати настільний клуб","donate_btn":"🎲 Підтримати клуб","donate_note":"Кошти: нові ігри, організація заходів та розваг","success":{"emoji":"🎲","title":"Дякуємо за підтримку!","text":"Ви допомагаєте молоді знаходити друзів і радість"},"cta_details_action":"openPopup(''games'')"}'::jsonb
),

-- 9 · Фестивалі та соціальні проєкти (ongoing)
(
  'events', 9, 'Фестивалі та соціальні проєкти', 'Масові заходи', '🎉', 'Масові заходи · Постійний',
  'Організація фестивалів, масових заходів і соціальних проєктів для всієї громади — об''єднуємо людей навколо спільних цінностей.',
  'Масові заходи — це чудовий спосіб зібрати громаду разом, весело провести час і створити незабутні враження. Ми організовуємо сезонні фестивалі, спортивні дні, творчі ярмарки та інші заходи — це можливість для дітей і молоді соціалізуватися, весело провести час і розвивати свої таланти в атмосфері радості.',
  '/photos/Events (main).webp', 'Масове дозвілля',
  '["/photos/Events (main).webp","/photos/Events 1.webp","/photos/Events 2.webp","/photos/Events 3.webp"]'::jsonb,
  array['Фестивалі','Масові заходи']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-navy","gradient_emoji":"","popup_details":[["📅 Частота","Сезонні"],["🎉 Типи","Фестивалі, турніри"]],"preset_amounts":["200 грн","500 грн","1 000 грн","2 500 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати масові заходи","donate_btn":"🎉 Підтримати заходи","donate_note":"Кошти: організація заходів, оренда локацій, нагороди для учасників","success":{"emoji":"📣","title":"Дякуємо за підтримку!","text":"Ви допомагаєте створювати незабутні враження для молоді"},"cta_details_action":"openPopup(''events'')"}'::jsonb
),

-- 10 · Групи вивчення Біблії (ongoing)
(
  'bible', 10, 'Групи вивчення Біблії', 'Духовний розвиток', '📖', 'Духовний розвиток · Постійний',
  'Групи вивчення Біблії — формуємо духовно зрілих людей, які свідомо обирають мудрий шлях у житті.',
  'Духовний розвиток — серце місії Wise Step. Ми проводимо групи вивчення Біблії для різних вікових груп, навчальні тренінги, освітні зустрічі та дискусії. Мета — допомогти молодим людям пізнати Бога та свідомо будувати своє життя.',
  '/photos/Bible (main).webp', 'Групи вивчення Біблії',
  '["/photos/Bible (main).webp","/photos/Bible 1.webp","/photos/Bible 2.webp","/photos/Bible 3.webp"]'::jsonb,
  array['Біблія','Навчання','Духовний розвиток']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-green","gradient_emoji":"📖","popup_details":[["📅 Частота","Щотижня"],["👥 Групи","За віком та інтересами"],["📚 Матеріали","Біблії, посібники"],["🎓 Тренінги","Лідерство, цінності"]],"preset_amounts":["300 грн","700 грн","1 500 грн","3 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати духовні програми","donate_btn":"📖 Підтримати програму","donate_note":"Кошти: навчальні матеріали, Біблії, організація тренінгів","success":{"emoji":"📖","title":"Дякуємо за підтримку!","text":"Ви вкладаєте у духовне зростання молодого покоління"},"cta_details_action":"openPopup(''bible'')"}'::jsonb
),

-- 11 · Освітні тренінги та майстер-класи (ongoing)
(
  'education', 11, 'Освітні тренінги та майстер-класи', 'Освітній', '📚', 'Освітній · Постійний',
  'Навчальні тренінги, освітні зустрічі — формування зрілого характеру, професійний розвиток та інвестиції в особистість.',
  'Освітні програми — важлива частина роботи Wise Step. Ми організовуємо тренінги та майстер-класи на різні теми — від особистого розвитку та лідерства до практичних навичок і життєвої мудрості. Ці програми допомагають молодим людям розвивати свій потенціал, будувати впевненість і готуватися до успішного майбутнього.',
  '/photos/Education (main).webp', 'Освітні тренінги та майстер-класи',
  '["/photos/Education (main).webp","/photos/Education 1.webp","/photos/Education 2.webp"]'::jsonb,
  array['Освіта','Навчання','Тренінги']::text[],
  'ongoing', 'active', false,
  false, null, null, null, null, null, null, false,
  'грн', 'https://send.monobank.ua/jar/2io8iF7dSo',
  '{"color_class":"g-tan","gradient_emoji":"","popup_details":[["📅 Дати","На протязі року"],["👥 Учасники","Для всіх!"],["📚 Матеріали","Навчальні посібники"],["🎓 Тренінги","Лідерство, цінності"]],"preset_amounts":["300 грн","700 грн","1 500 грн","3 000 грн"],"preset_active_idx":1,"donate_title":"💛 Підтримати освітні програми","donate_btn":"🎓 Підтримати освіту","donate_note":"Кошти: організація тренінгів, матеріали, гості-лектори","success":{"emoji":"📖","title":"Дякуємо за пíдтримку!","text":"Ви вкладаєте у розвиток молодого поколíння"},"cta_details_action":"openPopup(''education'')"}'::jsonb
)

on conflict (slug) do update set
  sort_order         = excluded.sort_order,
  title              = excluded.title,
  category           = excluded.category,
  icon               = excluded.icon,
  badge              = excluded.badge,
  short_description  = excluded.short_description,
  full_description   = excluded.full_description,
  cover_image        = excluded.cover_image,
  main_image_alt     = excluded.main_image_alt,
  gallery            = excluded.gallery,
  tags               = excluded.tags,
  status             = excluded.status,
  lifecycle          = excluded.lifecycle,
  featured           = excluded.featured,
  is_fundraiser      = excluded.is_fundraiser,
  goal_amount        = excluded.goal_amount,
  current_amount     = excluded.current_amount,
  donors_count       = excluded.donors_count,
  progress_percent   = excluded.progress_percent,
  amount_left        = excluded.amount_left,
  deadline_days      = excluded.deadline_days,
  progress_visible   = excluded.progress_visible,
  currency           = excluded.currency,
  external_donate_url = excluded.external_donate_url,
  presentation       = excluded.presentation;
