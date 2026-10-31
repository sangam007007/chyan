import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO exams (name_en, name_hi, description_en, description_hi, category, state, is_active, display_order) VALUES
      ('UP Police Constable', 'यूपी पुलिस कांस्टेबल', 'UP Police Constable recruitment exam', 'यूपी पुलिस कांस्टेबल भर्ती परीक्षा', 'state', 'Uttar Pradesh', true, 1),
      ('UP Police SI', 'यूपी पुलिस एसआई', 'UP Police Sub-Inspector recruitment exam', 'यूपी पुलिस उप-निरीक्षक भर्ती परीक्षा', 'state', 'Uttar Pradesh', true, 2),
      ('UP SI Civil', 'यूपी एसआई सिविल', 'UP Sub-Inspector Civil Police exam', 'यूपी उप-निरीक्षक सिविल पुलिस परीक्षा', 'state', 'Uttar Pradesh', true, 3),
      ('UP SI Platoon Commander', 'यूपी एसआई प्लाटून कमांडर', 'UP SI Platoon Commander (PAC) exam', 'यूपी एसआई प्लाटून कमांडर (पीएसी) परीक्षा', 'state', 'Uttar Pradesh', true, 4),
      ('UP Police Head Operator', 'यूपी पुलिस हेड ऑपरेटर', 'UP Police Head Operator recruitment exam', 'यूपी पुलिस हेड ऑपरेटर भर्ती परीक्षा', 'state', 'Uttar Pradesh', true, 5),
      ('UP Police ASI', 'यूपी पुलिस एएसआई', 'UP Police Asst Sub-Inspector exam', 'यूपी पुलिस सहायक उप-निरीक्षक परीक्षा', 'state', 'Uttar Pradesh', true, 6),
      ('SSC GD Constable', 'एसएससी जीडी कांस्टेबल', 'SSC General Duty Constable exam', 'एसएससी सामान्य ड्यूटी कांस्टेबल परीक्षा', 'central', NULL, true, 7),
      ('SSC CPO', 'एसएससी सीपीओ', 'SSC Central Police Organisation exam', 'एसएससी केंद्रीय पुलिस संगठन परीक्षा', 'central', NULL, true, 8),
      ('Delhi Police Constable', 'दिल्ली पुलिस कांस्टेबल', 'Delhi Police Constable recruitment exam', 'दिल्ली पुलिस कांस्टेबल भर्ती परीक्षा', 'state', 'Delhi', true, 9),
      ('Bihar Police Constable', 'बिहार पुलिस कांस्टेबल', 'Bihar Police Constable recruitment exam', 'बिहार पुलिस कांस्टेबल भर्ती परीक्षा', 'state', 'Bihar', true, 10);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DELETE FROM exams WHERE name_en IN (
      'UP Police Constable',
      'UP Police SI',
      'UP SI Civil',
      'UP SI Platoon Commander',
      'UP Police Head Operator',
      'UP Police ASI',
      'SSC GD Constable',
      'SSC CPO',
      'Delhi Police Constable',
      'Bihar Police Constable'
    );
  `);
}
