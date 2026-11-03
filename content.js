// Clinical content, built from TL002-SPC-001 (Clinical Content Specification). Change the spec first, then this file.
// Built-in items are fixed so validated scores stay valid; users can hide them but not reword them.
const C = (() => {
  const NOT_DX = 'This is a screening result, not a diagnosis. Discuss it with your GP or mental health professional.';
  const NOT_DX_PATTERN = 'This is a pattern summary, not a diagnosis. Discuss it with your GP or specialist.';

  // SPC §3.1 — DSM-5-TR panic attack symptoms, plain English
  const PANIC_SYMPTOMS = [
    ['DSM-PA-01', 'Heart pounding, racing or skipping'],
    ['DSM-PA-02', 'Sweating'],
    ['DSM-PA-03', 'Trembling or shaking'],
    ['DSM-PA-04', 'Short of breath or feeling smothered'],
    ['DSM-PA-05', 'Feeling of choking or a lump in the throat'],
    ['DSM-PA-06', 'Chest pain, tightness or discomfort'],
    ['DSM-PA-07', 'Nausea, sick stomach or tummy upset'],
    ['DSM-PA-08', 'Dizzy, light-headed, unsteady or faint'],
    ['DSM-PA-09', 'Chills or hot flushes'],
    ['DSM-PA-10', 'Numbness or tingling (e.g. hands, lips)'],
    ['DSM-PA-11', 'Feeling unreal, detached, or outside yourself'],
    ['DSM-PA-12', 'Fear of losing control or “going crazy”'],
    ['DSM-PA-13', 'Fear of dying'],
  ].map(([code, label]) => ({ code, label }));

  const PEAK = [['lt1', '< 1 min'], ['1-5', '1–5 min'], ['5-10', '5–10 min'], ['gt10', '> 10 min']];
  const PANIC_TYPE = [['expected', 'Expected (clear trigger)'], ['unexpected', 'Out of the blue'], ['nocturnal', 'Woke me from sleep']];

  // SPC §3.4 — agoraphobia situation groups
  const AGORA = [
    ['DSM-AG-1', 'Public transport', 'Buses, trains, planes, ferries, rideshare'],
    ['DSM-AG-2', 'Open spaces', 'Car parks, markets, bridges, large open areas'],
    ['DSM-AG-3', 'Enclosed places', 'Shops, cinemas, lifts, small rooms'],
    ['DSM-AG-4', 'Queues or crowds', 'Checkout lines, concerts, busy events'],
    ['DSM-AG-5', 'Being out of home alone', 'Walking, driving or being anywhere alone'],
  ].map(([code, label, hint]) => ({ code, label, hint }));
  const FEAR_SCALE = ['None', 'Mild', 'Moderate', 'Severe', 'Extreme'];
  const AVOID_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
  const PANIC_IMPACT = [
    'This week, how much did you worry about having another panic attack?',
    'How much did worry about panic change what you did?',
    'How much did panic or anxiety get in the way of work, study or home life?',
    'How much did it get in the way of social life or relationships?',
  ];
  const IMPACT_SCALE = ['Not at all', 'A little', 'Moderately', 'A lot', 'Extremely'];

  // SPC §3.5 — GAD associated symptoms
  const GAD_SYMPTOMS = [
    ['DSM-GAD-1', 'Restless, keyed up or on edge'],
    ['DSM-GAD-2', 'Tired easily'],
    ['DSM-GAD-3', 'Hard to concentrate, or mind going blank'],
    ['DSM-GAD-4', 'Irritable'],
    ['DSM-GAD-5', 'Tense or tight muscles'],
    ['DSM-GAD-6', 'Sleep problems'],
  ].map(([code, label]) => ({ code, label }));

  // SPC §3.7–3.9 — questionnaires (free to use, reproduced word for word)
  const FREQ4 = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
  const DIFFICULTY = ['Not difficult at all', 'Somewhat difficult', 'Very difficult', 'Extremely difficult'];
  const Q = {
    gad7: {
      name: 'GAD-7', title: 'Anxiety check (GAD-7)', cite: 'Spitzer, Kroenke, Williams & Löwe, 2006',
      stem: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
      scale: FREQ4, max: 21, difficulty: true,
      items: ['Feeling nervous, anxious, or on edge', 'Not being able to stop or control worrying', 'Worrying too much about different things',
        'Trouble relaxing', 'Being so restless that it is hard to sit still', 'Becoming easily annoyed or irritable', 'Feeling afraid, as if something awful might happen'],
      bands: [[0, 'Minimal', 'Few anxiety symptoms right now.'], [5, 'Mild', 'Some anxiety symptoms. Worth keeping an eye on.'],
        [10, 'Moderate', 'A level where talking to your GP or therapist is recommended.'], [15, 'Severe', 'High anxiety symptoms. Please raise this with your GP or therapist soon.']],
      note: 'A score of 10 or more is the usual cut-off for a follow-up assessment.',
    },
    phq9: {
      name: 'PHQ-9', title: 'Mood check (PHQ-9)', cite: 'Kroenke, Spitzer & Williams, 2001',
      stem: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
      scale: FREQ4, max: 27, difficulty: true, safetyItem: 8,
      items: ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep, or sleeping too much',
        'Feeling tired or having little energy', 'Poor appetite or overeating', 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
        'Trouble concentrating on things, such as reading the newspaper or watching television',
        'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
        'Thoughts that you would be better off dead or of hurting yourself in some way'],
      bands: [[0, 'Minimal', 'Few low-mood symptoms right now.'], [5, 'Mild', 'Some low-mood symptoms. Worth keeping an eye on.'],
        [10, 'Moderate', 'A level where talking to your GP or therapist is recommended.'], [15, 'Moderately severe', 'Please raise this with your GP or therapist soon.'],
        [20, 'Severe', 'Please talk to your GP or therapist soon.']],
    },
    phq15: {
      name: 'PHQ-15', title: 'Body symptoms check (PHQ-15)', cite: 'Kroenke, Spitzer & Williams, 2002',
      stem: 'During the past 4 weeks, how much have you been bothered by any of the following problems?',
      scale: ['Not bothered at all', 'Bothered a little', 'Bothered a lot'], max: 30,
      items: ['Stomach pain', 'Back pain', 'Pain in your arms, legs, or joints (knees, hips, etc.)', 'Menstrual cramps or other problems with your periods',
        'Headaches', 'Chest pain', 'Dizziness', 'Fainting spells', 'Feeling your heart pound or race', 'Shortness of breath',
        'Pain or problems during sexual intercourse', 'Constipation, loose bowels, or diarrhea', 'Nausea, gas, or indigestion',
        'Feeling tired or having low energy', 'Trouble sleeping'],
      bands: [[0, 'Minimal', ''], [5, 'Low', ''], [10, 'Medium', ''], [15, 'High', '']],
      note: 'Body symptoms can come from many causes, including anxiety, gut and cycle conditions. This score helps track how much they bother you overall.',
    },
  };

  // SPC §4.1 — DRSP items and their DSM PMDD areas (mapping as in C-PASS Table 1). © pending J. Endicott & W. Harrison.
  const DRSP_SCALE = ['Not at all', 'Minimal', 'Mild', 'Moderate', 'Severe', 'Extreme']; // scored 1–6
  const DRSP = [
    ['Felt depressed, sad, “down,” or “blue”', 'B3'], ['Felt hopeless', 'B3'], ['Felt worthless or guilty', 'B3'],
    ['Felt anxious, tense, “keyed up,” or “on edge”', 'B4'],
    ['Had mood swings (e.g. suddenly feeling sad or tearful)', 'B1'], ['Was more sensitive to rejection or my feelings were easily hurt', 'B1'],
    ['Felt angry, irritable', 'B2'], ['Had conflicts or problems with people', 'B2'],
    ['Had less interest in usual activities (e.g. work, school, friends, hobbies)', 'C5'], ['Had difficulty concentrating', 'C6'],
    ['Felt lethargic, tired, or fatigued; or had a lack of energy', 'C7'],
    ['Had increased appetite or overate', 'C8'], ['Had cravings for specific foods', 'C8'],
    ['Slept more, took naps, found it hard to get up when intended', 'C9'], ['Had trouble getting to sleep or staying asleep', 'C9'],
    ['Felt overwhelmed or unable to cope', 'C10'], ['Felt out of control', 'C10'],
    ['Had breast tenderness', 'C11'], ['Had breast swelling, felt “bloated,” or had weight gain', 'C11'], ['Had headache', 'C11'], ['Had joint or muscle pain', 'C11'],
  ].map(([label, area]) => ({ label, area }));
  const DRSP_IMPAIR = [
    'At work, school, home, or in daily routine, at least one of the problems above caused reduced productivity or inefficiency',
    'At least one of the problems above interfered with hobbies or social activities',
    'At least one of the problems above interfered with relationships with others',
  ];
  const PMDD_AREAS = [
    ['B1', 'Mood swings / sensitivity', true], ['B2', 'Irritability / conflict', true], ['B3', 'Low mood / hopeless', true], ['B4', 'Anxiety / tension', true],
    ['C5', 'Less interest', false], ['C6', 'Concentration', false], ['C7', 'Low energy', false], ['C8', 'Appetite / cravings', false],
    ['C9', 'Sleep change', false], ['C10', 'Overwhelmed', false], ['C11', 'Physical symptoms', false],
  ].map(([code, label, core]) => ({ code, label, core }));

  // SPC §5 — cycle and pelvic pain
  const FLOW = [['spotting', 'Spotting'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy'], ['vheavy', 'Very heavy']];
  const CLOTS = [['none', 'None'], ['small', 'Small (< 2.5 cm)'], ['large', 'Large (≥ 2.5 cm, 50c coin or bigger)']];
  const PRODUCTS = [['pad', 'Pads'], ['tampon', 'Tampons'], ['undies', 'Period undies'], ['cup', 'Cup emptied']];
  const PAIN_LOC = [
    ['lowc', 'Lower tummy centre'], ['lowl', 'Lower left'], ['lowr', 'Lower right'], ['upper', 'Upper tummy'], ['back', 'Lower back'],
    ['butt', 'Buttocks / tailbone'], ['thigh', 'Upper thighs'], ['vulva', 'Vulva / vagina'], ['rectum', 'Rectum / bottom'], ['shoulder', 'Shoulder tip'],
  ];
  const PAIN_TYPE = ['Cramping', 'Stabbing / sharp', 'Aching / dull', 'Burning', 'Pulling / dragging', 'Throbbing', 'Pressure'];
  const PAIN_LINK = [['period', 'Period'], ['sex', 'During or after sex'], ['bowel', 'Bowel motions'], ['urine', 'Passing urine'], ['exercise', 'Exercise'], ['ovulation', 'Ovulation time'], ['none', 'Not linked']];
  const RELIEF = ['None', 'A little', 'About half', 'Most', 'Complete'];

  // SPC §6 — Consensus Sleep Diary core
  const SLEEP_QUALITY = ['Very poor', 'Poor', 'Fair', 'Good', 'Very good'];

  // SPC §7 — food and GI
  const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];
  const PORTION = [['small', 'Small'], ['usual', 'Usual'], ['large', 'Large']];
  const BRISTOL = [
    [1, 'Separate hard lumps, like nuts; hard to pass', 'hard'], [2, 'Sausage-shaped but lumpy', 'hard'],
    [3, 'Sausage-shaped with cracks on the surface', 'normal'], [4, 'Smooth, soft sausage or snake', 'normal'],
    [5, 'Soft blobs with clear edges; passed easily', 'normal'], [6, 'Mushy, fluffy pieces with ragged edges', 'loose'], [7, 'Watery, no solid pieces', 'loose'],
  ].map(([type, label, group]) => ({ type, label, group }));
  const BLOOD = [['none', 'None'], ['paper', 'On paper'], ['bowl', 'In bowl / mixed']];

  // Built-in catalog items (users can hide them, and add their own of the same kind).
  const B = (kind, list) => list.map(([key, name, hint]) => ({ id: `${kind}:${key}`, kind, name, hint: hint || '', builtin: true }));
  const BUILTIN = [
    ...B('tag', [
      ['fructans', 'Fructans', 'FODMAP · wheat, rye, barley, onion, garlic, leek'], ['gos', 'GOS', 'FODMAP · legumes, lentils, chickpeas, cashews, pistachios'],
      ['lactose', 'Lactose', 'FODMAP · milk, yoghurt, soft cheese, ice cream'], ['fructose', 'Excess fructose', 'FODMAP · honey, apple, pear, mango, agave'],
      ['sorbitol', 'Polyols: sorbitol', 'FODMAP · stone fruit, apple, pear, sugar-free gum'], ['mannitol', 'Polyols: mannitol', 'FODMAP · mushrooms, cauliflower, snow peas'],
      ['gluten', 'Gluten'], ['dairy', 'Dairy (non-lactose)', 'Hard cheese, butter'], ['caffeine', 'Caffeine', 'Coffee, tea, energy drinks, cola, chocolate'],
      ['alcohol', 'Alcohol'], ['spicy', 'Spicy / chilli'], ['fatty', 'High-fat / fried'], ['sweetener', 'Artificial sweeteners'], ['fizzy', 'Fizzy drinks'],
      ['large', 'Large meal'], ['late', 'Late meal', 'Added automatically after your late-meal time'],
    ]),
    ...B('gisym', [
      ['bloating', 'Bloating (feeling)'], ['distension', 'Visible swelling'], ['pain', 'Abdominal pain'], ['cramping', 'Cramping'], ['nausea', 'Nausea'],
      ['vomiting', 'Vomiting'], ['reflux', 'Reflux / heartburn'], ['burping', 'Burping'], ['wind', 'Wind'], ['urgency', 'Urgency'],
      ['incomplete', 'Feeling of incomplete emptying'], ['fullness', 'Early fullness'], ['appetite', 'Loss of appetite'],
    ]),
    ...B('trigger', [['crowd', 'Crowd'], ['enclosed', 'Enclosed space'], ['driving', 'Driving'], ['transport', 'Public transport'],
      ['body', 'Health worry / body sensation'], ['caffeine', 'Caffeine'], ['conflict', 'Conflict'], ['work', 'Work / study'], ['alone', 'Alone'], ['other', 'Other']]),
    ...B('place', [['home', 'Home'], ['work', 'Work'], ['car', 'Car'], ['shops', 'Shops'], ['transport', 'Public transport'], ['outdoors', 'Outdoors'], ['other', 'Other']]),
    ...B('helper', [['breathing', 'Slow breathing'], ['grounding', 'Grounding'], ['left', 'Left the situation'], ['medication', 'Medication'],
      ['talked', 'Talked to someone'], ['rode', 'Rode it out'], ['nothing', 'Nothing helped']]),
  ];
  const KINDS = {
    food: 'Foods', tag: 'Food tags', gisym: 'GI symptoms', trigger: 'Panic triggers', place: 'Places', helper: 'What helps', med: 'Medications', contact: 'Support contacts',
  };

  // SPC §8 — support card. Numbers verified 2026-11-03 against the services' own pages (see SPC §8 sources).
  const SUPPORT = [
    ['Emergency / immediate danger', '000', '000'],
    ['Lifeline (24/7)', '13 11 14', '131114'], ['Lifeline text', '0477 13 11 14', 'sms:0477131114'],
    ['Suicide Call Back Service (24/7)', '1300 659 467', '1300659467'], ['Beyond Blue (24/7)', '1300 22 4636', '1300224636'],
    ['13YARN — Aboriginal & Torres Strait Islander (24/7)', '13 92 76', '139276'],
    ['WA Mental Health Emergency Response Line (Perth metro, 24/7)', '1300 555 788', '1300555788'],
    ['WA Mental Health Emergency Response Line (Peel)', '1800 676 822', '1800676822'],
    ['WA RuralLink (rural & remote: 4.30pm–8.30am weekdays, 24 h weekends & public holidays)', '1800 552 002', '1800552002'],
  ];

  // Learn panel — plain-English criteria (paraphrased; see SPC §3.3, §3.4, §3.5, §4.2, §6, §7.6)
  const LEARN = [
    ['Panic attack', 'A sudden surge of intense fear or discomfort that peaks within minutes, with 4 or more of the 13 listed symptoms. Fewer than 4 is a “limited-symptom” attack.'],
    ['Panic disorder', 'A. Unexpected panic attacks that keep coming back. B. For a month or more after at least one: ongoing worry about more attacks or what they mean, and/or changing behaviour to avoid them. C. Not caused by a substance, medicine or another medical condition (e.g. thyroid or heart problems). D. Not better explained by another mental health condition.'],
    ['Agoraphobia', 'Fear or avoidance in 2 or more of 5 situation groups (public transport, open spaces, enclosed places, queues or crowds, being out of home alone), because escape might be hard or help might not be available if panic-like symptoms happen.'],
    ['Generalised anxiety', 'Hard-to-control worry on more days than not for 6 months or more, with 3 or more of: restlessness, tiring easily, poor concentration, irritability, muscle tension, sleep problems.'],
    ['PMDD', 'In most cycles, 5 or more symptoms in the final week before the period, at least one of them mood swings, irritability, low mood or anxiety. They ease within a few days of the period starting and are minimal in the week after. Needs daily ratings over at least 2 cycles to confirm.'],
    ['Insomnia', 'Trouble falling asleep, staying asleep or waking too early on 3 or more nights a week for 3 months or more, with daytime impact.'],
    ['IBS (Rome IV)', 'Tummy pain on average at least 1 day a week over 3 months, linked to 2 or more of: bowel motions, a change in how often you go, a change in stool form. Symptoms began at least 6 months ago. A doctor needs to rule out other causes (e.g. coeliac disease, IBD).'],
    ['Panic and the gut', 'Nausea and tummy upset are also panic symptoms. Logging both panic and GI symptoms helps tell them apart over time.'],
    ['Cycle limits (FIGO 2018)', 'Typical cycles are 24–38 days, periods up to 8 days, and the shortest and longest cycles within 9 days of each other.'],
    ['When to see a GP about your gut', 'Blood or black stool, unexplained weight loss, symptoms that wake you, persistent vomiting, difficulty swallowing, fever, new symptoms after 50, or a family history of bowel cancer, coeliac disease or IBD.'],
  ];

  return { NOT_DX, NOT_DX_PATTERN, PANIC_SYMPTOMS, PEAK, PANIC_TYPE, AGORA, FEAR_SCALE, AVOID_SCALE, PANIC_IMPACT, IMPACT_SCALE, GAD_SYMPTOMS,
    DIFFICULTY, Q, DRSP_SCALE, DRSP, DRSP_IMPAIR, PMDD_AREAS, FLOW, CLOTS, PRODUCTS, PAIN_LOC, PAIN_TYPE, PAIN_LINK, RELIEF, SLEEP_QUALITY,
    MEAL_TYPES, PORTION, BRISTOL, BLOOD, BUILTIN, KINDS, SUPPORT, LEARN };
})();
