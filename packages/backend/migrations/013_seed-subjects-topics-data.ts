import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Seed 4 subjects for UP Police Constable exam
  pgm.sql(`
    INSERT INTO subjects (exam_id, name_en, name_hi, display_order)
    VALUES
      ((SELECT id FROM exams WHERE name_en = 'UP Police Constable'), 'Hindi', 'हिन्दी', 1),
      ((SELECT id FROM exams WHERE name_en = 'UP Police Constable'), 'General Knowledge', 'सामान्य ज्ञान', 2),
      ((SELECT id FROM exams WHERE name_en = 'UP Police Constable'), 'Numerical Ability', 'संख्यात्मक योग्यता', 3),
      ((SELECT id FROM exams WHERE name_en = 'UP Police Constable'), 'Mental Ability/Reasoning', 'मानसिक योग्यता/तर्कशक्ति', 4);
  `);

  // Seed topics for Hindi (3 topics)
  pgm.sql(`
    INSERT INTO topics (subject_id, name_en, name_hi, display_order)
    VALUES
      ((SELECT id FROM subjects WHERE name_en = 'Hindi'), 'Synonyms', 'पर्यायवाची शब्द', 1),
      ((SELECT id FROM subjects WHERE name_en = 'Hindi'), 'Antonyms', 'विलोम शब्द', 2),
      ((SELECT id FROM subjects WHERE name_en = 'Hindi'), 'Grammar', 'व्याकरण', 3);
  `);

  // Seed topics for General Knowledge (5 topics)
  pgm.sql(`
    INSERT INTO topics (subject_id, name_en, name_hi, display_order)
    VALUES
      ((SELECT id FROM subjects WHERE name_en = 'General Knowledge'), 'Indian History', 'भारतीय इतिहास', 1),
      ((SELECT id FROM subjects WHERE name_en = 'General Knowledge'), 'Indian Geography', 'भारतीय भूगोल', 2),
      ((SELECT id FROM subjects WHERE name_en = 'General Knowledge'), 'Indian Polity', 'भारतीय राजव्यवस्था', 3),
      ((SELECT id FROM subjects WHERE name_en = 'General Knowledge'), 'Current Affairs', 'समसामयिकी', 4),
      ((SELECT id FROM subjects WHERE name_en = 'General Knowledge'), 'General Science', 'सामान्य विज्ञान', 5);
  `);

  // Seed topics for Numerical Ability (4 topics)
  pgm.sql(`
    INSERT INTO topics (subject_id, name_en, name_hi, display_order)
    VALUES
      ((SELECT id FROM subjects WHERE name_en = 'Numerical Ability'), 'Arithmetic', 'अंकगणित', 1),
      ((SELECT id FROM subjects WHERE name_en = 'Numerical Ability'), 'Percentage', 'प्रतिशत', 2),
      ((SELECT id FROM subjects WHERE name_en = 'Numerical Ability'), 'Time and Distance', 'समय और दूरी', 3),
      ((SELECT id FROM subjects WHERE name_en = 'Numerical Ability'), 'Profit and Loss', 'लाभ और हानि', 4);
  `);

  // Seed topics for Mental Ability/Reasoning (4 topics)
  pgm.sql(`
    INSERT INTO topics (subject_id, name_en, name_hi, display_order)
    VALUES
      ((SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning'), 'Number Series', 'संख्या श्रृंखला', 1),
      ((SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning'), 'Analogy', 'सादृश्यता', 2),
      ((SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning'), 'Classification', 'वर्गीकरण', 3),
      ((SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning'), 'Coding-Decoding', 'कोडिंग-डिकोडिंग', 4);
  `);

  // Seed 80 tests: 5 per topic (first 3 premium, last 2 free)
  // Hindi topics
  pgm.sql(`
    INSERT INTO tests (title_en, title_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, category, subject_id, topic_id)
    SELECT
      topics.name_en || ' Test ' || nums.n,
      topics.name_hi || ' टेस्ट ' || nums.n,
      (SELECT id FROM exams WHERE name_en = 'UP Police Constable'),
      15, 10, 1, 0.25, 5, nums.pricing_type, 'published', 'subject_wise',
      (SELECT id FROM subjects WHERE name_en = 'Hindi'),
      topics.id
    FROM topics
    CROSS JOIN (VALUES
      (1, 'premium'), (2, 'premium'), (3, 'premium'), (4, 'free'), (5, 'free')
    ) AS nums(n, pricing_type)
    WHERE topics.subject_id = (SELECT id FROM subjects WHERE name_en = 'Hindi');
  `);

  // General Knowledge topics
  pgm.sql(`
    INSERT INTO tests (title_en, title_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, category, subject_id, topic_id)
    SELECT
      topics.name_en || ' Test ' || nums.n,
      topics.name_hi || ' टेस्ट ' || nums.n,
      (SELECT id FROM exams WHERE name_en = 'UP Police Constable'),
      15, 10, 1, 0.25, 5, nums.pricing_type, 'published', 'subject_wise',
      (SELECT id FROM subjects WHERE name_en = 'General Knowledge'),
      topics.id
    FROM topics
    CROSS JOIN (VALUES
      (1, 'premium'), (2, 'premium'), (3, 'premium'), (4, 'free'), (5, 'free')
    ) AS nums(n, pricing_type)
    WHERE topics.subject_id = (SELECT id FROM subjects WHERE name_en = 'General Knowledge');
  `);

  // Numerical Ability topics
  pgm.sql(`
    INSERT INTO tests (title_en, title_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, category, subject_id, topic_id)
    SELECT
      topics.name_en || ' Test ' || nums.n,
      topics.name_hi || ' टेस्ट ' || nums.n,
      (SELECT id FROM exams WHERE name_en = 'UP Police Constable'),
      15, 10, 1, 0.25, 5, nums.pricing_type, 'published', 'subject_wise',
      (SELECT id FROM subjects WHERE name_en = 'Numerical Ability'),
      topics.id
    FROM topics
    CROSS JOIN (VALUES
      (1, 'premium'), (2, 'premium'), (3, 'premium'), (4, 'free'), (5, 'free')
    ) AS nums(n, pricing_type)
    WHERE topics.subject_id = (SELECT id FROM subjects WHERE name_en = 'Numerical Ability');
  `);

  // Mental Ability/Reasoning topics
  pgm.sql(`
    INSERT INTO tests (title_en, title_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, category, subject_id, topic_id)
    SELECT
      topics.name_en || ' Test ' || nums.n,
      topics.name_hi || ' टेस्ट ' || nums.n,
      (SELECT id FROM exams WHERE name_en = 'UP Police Constable'),
      15, 10, 1, 0.25, 5, nums.pricing_type, 'published', 'subject_wise',
      (SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning'),
      topics.id
    FROM topics
    CROSS JOIN (VALUES
      (1, 'premium'), (2, 'premium'), (3, 'premium'), (4, 'free'), (5, 'free')
    ) AS nums(n, pricing_type)
    WHERE topics.subject_id = (SELECT id FROM subjects WHERE name_en = 'Mental Ability/Reasoning');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Delete seeded tests (tests with subject_id pointing to our seeded subjects)
  pgm.sql(`
    DELETE FROM tests
    WHERE subject_id IN (
      SELECT id FROM subjects
      WHERE exam_id = (SELECT id FROM exams WHERE name_en = 'UP Police Constable')
        AND name_en IN ('Hindi', 'General Knowledge', 'Numerical Ability', 'Mental Ability/Reasoning')
    );
  `);

  // Delete seeded topics
  pgm.sql(`
    DELETE FROM topics
    WHERE subject_id IN (
      SELECT id FROM subjects
      WHERE exam_id = (SELECT id FROM exams WHERE name_en = 'UP Police Constable')
        AND name_en IN ('Hindi', 'General Knowledge', 'Numerical Ability', 'Mental Ability/Reasoning')
    );
  `);

  // Delete seeded subjects
  pgm.sql(`
    DELETE FROM subjects
    WHERE exam_id = (SELECT id FROM exams WHERE name_en = 'UP Police Constable')
      AND name_en IN ('Hindi', 'General Knowledge', 'Numerical Ability', 'Mental Ability/Reasoning');
  `);
}
