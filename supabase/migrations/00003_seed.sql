-- WiseStep Admin — realistic seed content (Ukrainian, matching wise-step.org tone)

-- Sample registration form: Summer Camp 2026
insert into public.forms (title, slug, schema, style, is_published)
values (
  'Реєстрація на літній табір 2026',
  'litniy-tabir-2026',
  '{
    "fields": [
      {"id": "child_name", "type": "text", "label": "Ім''я та прізвище дитини", "placeholder": "Марія Шевченко", "required": true},
      {"id": "birth_date", "type": "date", "label": "Дата народження дитини", "required": true},
      {"id": "parent_name", "type": "text", "label": "Ім''я та прізвище одного з батьків", "required": true},
      {"id": "parent_phone", "type": "phone", "label": "Контактний телефон", "placeholder": "+380 __ ___ __ __", "required": true},
      {"id": "parent_email", "type": "email", "label": "Електронна пошта", "placeholder": "email@example.com", "required": true},
      {"id": "shift", "type": "radio", "label": "Зміна", "required": true, "options": ["Перша зміна (29 червня — 5 липня)", "Друга зміна (13 — 19 липня)"]},
      {"id": "tshirt_size", "type": "select", "label": "Розмір футболки дитини", "required": true, "options": ["116-122", "128-134", "140-146", "152-158", "164-170"]},
      {"id": "activities", "type": "checkbox", "label": "Які активності цікавлять дитину?", "required": false, "options": ["Флорбол", "Творчі майстерні", "Походи в гори", "Настільні ігри"]},
      {"id": "health_notes", "type": "textarea", "label": "Особливості здоров''я, алергії, важлива інформація", "placeholder": "Напишіть, якщо є щось, про що нам варто знати", "required": false}
    ]
  }'::jsonb,
  '{"accentColor": "#01B5B4", "showLogo": true, "description": "Табір у Карпатах для дітей 8–15 років. Заповніть форму — і ми зв''яжемося з вами протягом двох днів."}'::jsonb,
  true
);

-- Sample projects
insert into public.projects (title, category, icon, short_description, full_description, status, tags, is_fundraiser, goal_amount, current_amount, donors_count, external_donate_url)
values
  (
    'Флорбольний клуб',
    'Спорт',
    '🏑',
    'Регулярні тренування з флорболу для дітей та підлітків у Сваляві.',
    'Флорбол — це швидка та захоплива командна гра, що розвиває координацію, витривалість і командний дух. Тренування відбуваються двічі на тиждень у спортивній залі. Запрошуємо дітей від 8 років — досвід не потрібен, ключки та м''ячі надаємо.',
    'ongoing',
    '{"спорт", "діти", "флорбол"}',
    false, null, null, null, null
  ),
  (
    'Літній табір у Карпатах 2026',
    'Табір',
    '⛺',
    'Тижневий табір для дітей 8–15 років: гори, творчість, нові друзі.',
    'Щоліта ми вивозимо дітей у Карпати на тиждень пригод: походи, творчі майстерні, спортивні ігри та вечірні ватри. Цього року плануємо дві зміни по 40 дітей. Збираємо кошти, щоб десять дітей із родин у складних обставинах поїхали безкоштовно.',
    'campaign',
    '{"табір", "Карпати", "збір"}',
    true, 120000, 47500, 63, 'https://send.monobank.ua/jar/example'
  ),
  (
    'Творчі майстерні',
    'Творчість',
    '🎨',
    'Щотижневі майстерні з малювання, ліплення та рукоділля.',
    'Простір, де діти можуть творити без оцінок і поспіху. Щосуботи проводимо майстерні з різних технік: акварель, глина, аплікація, вишивка. Матеріали надаємо, вікова група — від 6 років.',
    'ongoing',
    '{"творчість", "діти"}',
    false, null, null, null, null
  );

-- Sample quiz: Camp Icebreaker
with quiz as (
  insert into public.quizzes (title)
  values ('Квіз-знайомство для табору')
  returning id
)
insert into public.quiz_questions (quiz_id, question_text, options, correct_indexes, time_limit_seconds, points, position)
select quiz.id, q.question_text, q.options::jsonb, q.correct_indexes, q.time_limit_seconds, q.points, q.position
from quiz,
(values
  ('У якому місті знаходиться Wise Step?', '["Свалява", "Мукачево", "Ужгород", "Хуст"]', '{0}'::int[], 20, 1000, 0),
  ('Які гори оточують наш табір?', '["Альпи", "Карпати", "Татри", "Кримські гори"]', '{1}'::int[], 15, 1000, 1),
  ('Що потрібно для гри у флорбол? (декілька відповідей)', '["Ключка", "М''яч", "Ковзани", "Ракетка"]', '{0,1}'::int[], 20, 1500, 2),
  ('Скільки днів триває одна зміна табору?', '["3", "5", "7", "14"]', '{2}'::int[], 15, 1000, 3),
  ('Яка головна вечірня традиція табору?', '["Дискотека", "Ватра", "Кінопоказ", "Караоке"]', '{1}'::int[], 15, 1000, 4)
) as q(question_text, options, correct_indexes, time_limit_seconds, points, position);
