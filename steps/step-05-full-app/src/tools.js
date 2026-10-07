import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the exact hourly occurrence, mechanics, and cardinal directions of the Hejnał Mariacki.
 * @returns {Promise<object>} Detailed schedule and acoustic mechanics
 */
export async function getTrumpetCallSchedule() {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const minutesUntilNext = 60 - currentMinutes;
  const nextHour = (now.getHours() + 1) % 24;
  const formattedNextHour = `${String(nextHour).padStart(2, '0')}:00`;

  return {
    success: true,
    eventName: 'Hejnał Mariacki (St. Mary\'s Trumpet Call)',
    location: 'St. Mary\'s Basilica (Bazylika Mariacka), Kraków Main Market Square',
    towerHeight: '82 metres (Higher Northern Spire / Hejnalica)',
    frequency: 'Every single hour, 24 hours a day, 365 days a year',
    nextOccurrenceInMinutes: minutesUntilNext,
    nextScheduledTime: formattedNextHour,
    executionMechanics: {
      performer: 'Active-duty firefighters from the Kraków State Fire Service (Szkoła Aspirantów PSP)',
      instrument: 'B-flat trumpet (trąbka sygnałowa)',
      fourCardinalDirectionsOrder: [
        { sequence: 1, direction: 'South', facing: 'Wawel Royal Castle (to honor the Polish Monarch)' },
        { sequence: 2, direction: 'West', facing: 'Town Hall Tower / Rynek (to honor the City Mayor and Municipal Council)' },
        { sequence: 3, direction: 'North', facing: 'St. Florian\'s Gate / Barbican (to alert city guards and travelers on the Royal Route)' },
        { sequence: 4, direction: 'East', facing: 'Small Market Square / Fire Brigade Headquarters (to honor the firemaster)' }
      ],
      theSuddenSilence: 'The melody breaks off mid-note abruptly to commemorate the heroic 13th-century trumpeter who was shot through the throat by a Mongol (Tatar) arrow during the siege of Kraków in 1241.'
    },
    broadcastTip: 'Every day at precisely 12:00 PM noon, the Hejnał is broadcast live nationwide across Poland on Polskie Radio Program 1.'
  };
}

/**
 * Locates the active wawel_pricing.md file across environment variables and directory conventions.
 * Prioritizes WAWEL_PRICING_PATH, MUTABLE_DIR, and whichever existing candidate was most recently modified.
 * @returns {string|null} Resolved file path or null
 */
export function getMutableWawelPricingFilePath() {
  if (process.env.WAWEL_PRICING_PATH && fs.existsSync(process.env.WAWEL_PRICING_PATH)) {
    return process.env.WAWEL_PRICING_PATH;
  }
  if (process.env.MUTABLE_DIR) {
    const envPath = path.join(process.env.MUTABLE_DIR, 'wawel_pricing.md');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }

  const localStepPath = path.resolve(__dirname, '../data/mutable/wawel_pricing.md');
  const rootPath = path.resolve(process.cwd(), 'data/mutable/wawel_pricing.md');

  const stepExists = fs.existsSync(localStepPath);
  const rootExists = fs.existsSync(rootPath);

  if (stepExists && rootExists) {
    try {
      const stepMtime = fs.statSync(localStepPath).mtimeMs;
      const rootMtime = fs.statSync(rootPath).mtimeMs;
      return rootMtime > stepMtime ? rootPath : localStepPath;
    } catch {
      return localStepPath;
    }
  }

  if (stepExists) return localStepPath;
  if (rootExists) return rootPath;
  return null;
}

/**
 * Dynamically parse live Wawel exhibition admission prices from mutable markdown.
 * Reads the markdown table under `Permanent Exhibitions` in `wawel_pricing.md`.
 * Falls back to default 2026 season pricing if the file is unavailable or parsing fails.
 * @returns {{ stateRooms: { regular: number, reduced: number }, apartments: { regular: number, reduced: number }, treasury: { regular: number, reduced: number }, dragonsDen: { regular: number, reduced: number } }}
 */
export function loadMutableWawelPricing() {
  const defaultPricing = {
    stateRooms: { regular: 55, reduced: 40 },
    apartments: { regular: 50, reduced: 35 },
    treasury: { regular: 45, reduced: 30 },
    dragonsDen: { regular: 12, reduced: 12 }
  };

  const pricingFile = getMutableWawelPricingFilePath();
  if (!pricingFile) {
    return defaultPricing;
  }

  try {
    const rawContent = fs.readFileSync(pricingFile, 'utf-8');
    const parsed = { ...defaultPricing };
    const lines = rawContent.split(/\r?\n/);

    for (const line of lines) {
      if (!line.includes('|')) continue;
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 3) continue;

      const exhibitionName = cols[0].replace(/\*\*/g, '').toLowerCase();
      const regMatch = cols[1].match(/(\d+)/);
      const redMatch = cols[2].match(/(\d+)/);

      if (!regMatch) continue;
      const regular = parseInt(regMatch[1], 10);
      const reduced = redMatch ? parseInt(redMatch[1], 10) : regular;

      if (exhibitionName.includes('state rooms') || exhibitionName.includes('reprezentacyjne')) {
        parsed.stateRooms = { regular, reduced };
      } else if (exhibitionName.includes('private apartments') || exhibitionName.includes('apartamenty')) {
        parsed.apartments = { regular, reduced };
      } else if (exhibitionName.includes('treasury') || exhibitionName.includes('skarbiec')) {
        parsed.treasury = { regular, reduced };
      } else if (exhibitionName.includes('dragon') || exhibitionName.includes('smocza')) {
        parsed.dragonsDen = { regular, reduced };
      }
    }

    return parsed;
  } catch (err) {
    console.warn('[Tools] Unable to parse mutable Wawel pricing markdown, using defaults:', err.message);
    return defaultPricing;
  }
}

/**
 * Live ticket simulator checking remaining quotas for Wawel Royal Castle exhibitions.
 * Dynamically queries current exhibition admission prices from mutable markdown.
 * @param {object} args
 * @param {string} args.date - Date in YYYY-MM-DD or descriptive date string (e.g. '2026-10-15', 'tomorrow')
 * @returns {Promise<object>} Ticket availability breakdown
 */
export async function getWawelTicketAvailability(args) {
  const dateStr = args?.date || 'today';
  let targetDate = new Date();

  if (dateStr.toLowerCase() === 'tomorrow') {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (dateStr.toLowerCase() !== 'today') {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const isoDate = targetDate.toISOString().split('T')[0];
  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const isMonday = dayOfWeek === 1;

  // Realistic deterministic pseudo-availability based on date hash
  const seed = isoDate.split('-').reduce((acc, num) => acc + parseInt(num, 10), 0);

  const stateRoomsLeft = isMonday ? 0 : Math.max(12, (seed * 7) % 180);
  const apartmentsLeft = isMonday ? 0 : Math.max(0, (seed * 3) % 45);
  const treasuryLeft = isMonday ? 0 : Math.max(4, (seed * 5) % 110);
  const dragonsDenLeft = isMonday ? 120 : Math.max(25, (seed * 11) % 300);

  // Dynamically load live admission prices from mutable markdown
  const pricing = loadMutableWawelPricing();

  return {
    success: true,
    queryDate: isoDate,
    dayOfWeek: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
    mondaySpecialNotice: isMonday
      ? 'Mondays offer limited free exhibition entry tickets available exclusively at the physical ticket office from 9:00 AM on a first-come, first-served basis. Standard exhibitions are closed or on restricted schedules.'
      : 'Full exhibitions open with timed slot entry.',
    exhibitions: [
      {
        name: 'Royal State Rooms (Reprezentacyjne Komnaty Królewskie)',
        status: isMonday ? 'Closed / Monday Free Limited Slot' : (stateRoomsLeft < 20 ? 'Low Availability' : 'Available'),
        availableTickets: stateRoomsLeft,
        priceRegularPLN: pricing.stateRooms.regular,
        priceReducedPLN: pricing.stateRooms.reduced
      },
      {
        name: 'Royal Private Apartments (Prywatne Apartamenty Królewskie)',
        status: isMonday ? 'Closed' : (apartmentsLeft < 10 ? 'Nearly Sold Out' : 'Available'),
        availableTickets: apartmentsLeft,
        priceRegularPLN: pricing.apartments.regular,
        priceReducedPLN: pricing.apartments.reduced,
        note: 'Requires licensed guide accompaniment (included in ticket).'
      },
      {
        name: 'Crown Treasury (Skarbiec Koronny)',
        status: isMonday ? 'Closed' : (treasuryLeft < 15 ? 'Low Availability' : 'Available'),
        availableTickets: treasuryLeft,
        priceRegularPLN: pricing.treasury.regular,
        priceReducedPLN: pricing.treasury.reduced
      },
      {
        name: 'Dragon\'s Den (Smocza Jama)',
        status: 'Available',
        availableTickets: dragonsDenLeft,
        priceRegularPLN: pricing.dragonsDen.regular,
        priceReducedPLN: pricing.dragonsDen.reduced
      }
    ],
    officialBookingPortal: 'https://bilety.wawel.krakow.pl',
    reservationHelpline: '+48 12 422 51 55 ext. 291',
    recommendation: stateRoomsLeft < 30 || apartmentsLeft < 15
      ? 'High tourist demand expected for this date. Book immediately through the official portal to secure your preferred morning entry slot.'
      : 'Healthy ticket inventory remains for morning and afternoon entry slots.'
  };
}

/**
 * Curated authentic Kraków restaurant recommendations based on district and budget tier.
 * @param {object} args
 * @param {string} [args.district] - 'Old Town' | 'Kazimierz' | 'Podgórze' | 'Any'
 * @param {string} [args.budget] - 'budget' | 'milk bar' | 'moderate' | 'fine dining'
 * @returns {Promise<object>} Curated culinary guide
 */
export async function recommendLocalDining(args = {}) {
  const districtInput = (args?.district || 'Any').trim().toLowerCase();
  const budgetInput = (args?.budget || 'moderate').trim().toLowerCase();

  const RESTAURANT_DATABASE = [
    // Milk Bars (Bar Mleczny) & Budget
    {
      name: 'Bar Mleczny „Pod Temidą”',
      district: 'Old Town',
      address: 'ul. Grodzka 43 (along the Royal Route)',
      budgetTier: 'budget',
      priceRange: '15 - 30 PLN per person',
      cuisine: 'Traditional Polish Milk Bar (Canteen)',
      specialties: ['Pierogi ruskie with caramelized onion', 'Barszcz czerwony z uszkami', 'Kopytka potato dumplings with mushroom sauce', 'Kompot owocowy'],
      ambiance: 'Vintage communist-era Polish canteen heritage, self-service counter, bustling with students and professors.',
      reservationNeeded: false
    },
    {
      name: 'Bar Mleczny „Górnik”',
      district: 'Old Town',
      address: 'ul. Czysta 8',
      budgetTier: 'budget',
      priceRange: '14 - 28 PLN per person',
      cuisine: 'Classic Homestyle Polish Milk Bar',
      specialties: ['Kotlet schabowy with mashed potatoes and mizeria (cucumber salad)', 'Naleśniki z serem (sweet curd cheese crepes)', 'Żurek w kubku'],
      ambiance: 'Authentic local gem hidden from the heavy tourist routes, generous homecooked portions.',
      reservationNeeded: false
    },
    {
      name: 'Polakowski Self Service',
      district: 'Kazimierz',
      address: 'ul. Miodowa 39',
      budgetTier: 'budget',
      priceRange: '20 - 35 PLN per person',
      cuisine: 'Galician Polish Comfort Food',
      specialties: ['Bigos staropolski (hunter\'s stew with wild mushrooms & prunes)', 'Gołąbki in tomato sauce', 'Lentil pierogi'],
      ambiance: 'Rustic brick walls, wooden long benches, cozy Kazimierz folk atmosphere.',
      reservationNeeded: false
    },
    {
      name: 'Plac Nowy Okrąglak (Street Food)',
      district: 'Kazimierz',
      address: 'Plac Nowy (Rotunda)',
      budgetTier: 'budget',
      priceRange: '16 - 26 PLN',
      cuisine: 'Iconic Kraków Street Food',
      specialties: ['Zapiekanka tradycyjna (toasted half-baguette with sautéed mushrooms, melted cheese, and chives)', 'Zapiekanka zbójnicka (with oscypek cheese and cranberries)'],
      ambiance: 'Lively open-air square market, perfect night bite.',
      reservationNeeded: false
    },

    // Moderate / Traditional Sit-Down
    {
      name: 'Restauracja Morskie Oko',
      district: 'Old Town',
      address: 'Plac Szczepański 8',
      budgetTier: 'moderate',
      priceRange: '60 - 110 PLN per person',
      cuisine: 'Tatra Highland & Southern Polish Folklore',
      specialties: ['Żurek po góralsku served inside sourdough bread loaf', 'Grilled Oscypek sheep cheese with warm lingonberry relish', 'Pork knuckle (golonka) roasted in dark beer', 'Jagnięcina podhalańska (Tatra lamb)'],
      ambiance: 'Log cabin decor with roaring open stone fireplace, hand-carved woodwork, and live Highlander folk band in the evenings.',
      reservationNeeded: true
    },
    {
      name: 'Restauracja Starka',
      district: 'Kazimierz',
      address: 'ul. Józefa 14',
      budgetTier: 'moderate',
      priceRange: '70 - 130 PLN per person',
      cuisine: 'Warm Galician & Kazimierz Comfort Dining',
      specialties: ['Duck breast with apples and blackcurrant-clove reduction', 'Venison goulash with buckwheat groats', 'House-infused vodkas (ginger, horseradish, rowanberry, quince)'],
      ambiance: 'Intimate candlelit brick vaults, jazz background, friendly and charming service.',
      reservationNeeded: true
    },
    {
      name: 'Restauracja Pod Aniołami',
      district: 'Old Town',
      address: 'ul. Grodzka 35',
      budgetTier: 'moderate',
      priceRange: '80 - 150 PLN per person',
      cuisine: 'Historical Royal Polish Cuisine',
      specialties: ['Meats marinated in wild herbs roasted over natural beechwood embers in open medieval fireplace', 'Royal wild mushroom soup in bread bowl', 'Sarmatian roast boar'],
      ambiance: '13th-century Gothic cellar vaults, historic heraldry, royal heritage atmosphere.',
      reservationNeeded: true
    },

    // Fine Dining & Haute Cuisine
    {
      name: 'Bottiglieria 1881',
      district: 'Kazimierz',
      address: 'ul. Bocheńska 5',
      budgetTier: 'fine dining',
      priceRange: '450 - 750 PLN per person (Tasting Menu)',
      cuisine: 'Progressive Polish Gastronomy & Wine Pairing',
      specialties: ['Artisanal modern interpretations of Małopolska forest ingredients, local river trout, Baltic preserves, and fermented orchard fruits'],
      ambiance: 'Two Michelin Stars (Kraków\'s highest culinary honor). Minimalist Scandinavian-Polish open-kitchen counter, sublime wine cellar.',
      reservationNeeded: true
    },
    {
      name: 'Szara Gęś w Kuchni (The Grey Goose)',
      district: 'Old Town',
      address: 'Rynek Główny 17',
      budgetTier: 'fine dining',
      priceRange: '140 - 240 PLN per person',
      cuisine: 'Modern Polish Fine Dining',
      specialties: ['Oat-fattened Polish goose breast with caramelized plum', 'Veal tartar with truffles and quail egg', 'The signature "Szara Gęś" dessert (spun-sugar egg nest with chocolate mousse and passion fruit)'],
      ambiance: '14th-century Gothic rib-vaulted hall directly facing the illuminated Cloth Hall and St. Mary\'s Basilica.',
      reservationNeeded: true
    },
    {
      name: 'Copernicus Restaurant',
      district: 'Old Town',
      address: 'ul. Kanonicza 16',
      budgetTier: 'fine dining',
      priceRange: '200 - 350 PLN per person',
      cuisine: 'Royal Court Gastronomy',
      specialties: ['Deer tenderloin with roasted parsnip and juniper jus', 'Pikeperch fillet with crayfish bisque', 'Historical Renaissance desserts'],
      ambiance: 'Luxury boutique hotel under a 500-year-old painted Renaissance wood ceiling, situated on Kraków\'s oldest preserved street.',
      reservationNeeded: true
    }
  ];

  const matched = RESTAURANT_DATABASE.filter(r => {
    const matchesDistrict = districtInput === 'any' || r.district.toLowerCase().includes(districtInput);
    const matchesBudget =
      budgetInput === 'any' ||
      (budgetInput.includes('budget') || budgetInput.includes('milk') || budgetInput.includes('cheap')
        ? r.budgetTier === 'budget'
        : budgetInput.includes('fine') || budgetInput.includes('luxury') || budgetInput.includes('michelin')
          ? r.budgetTier === 'fine dining'
          : r.budgetTier === 'moderate');

    return matchesDistrict && matchesBudget;
  });

  const selections = matched.length > 0 ? matched : RESTAURANT_DATABASE.slice(0, 3);

  return {
    success: true,
    filterApplied: { district: districtInput, budget: budgetInput },
    totalRecommendations: selections.length,
    recommendations: selections,
    culturalFoodTips: [
      'In a Milk Bar (Bar Mleczny), order at the cash register, take your tray when your dish number or name is called, and return the dirty dishes to the hatch (zwrot naczyń). Tipping is not customary in milk bars.',
      'Always try the Obwarzanek Krakowski (the braided, ring-shaped bread sprinkled with poppy seeds or salt, sold from blue street pushcarts) which holds EU Protected Geographical Indication status since 2010.',
      'Standard dining etiquette in sit-down restaurants includes a 10% gratuity for good service.'
    ]
  };
}

/**
 * Tool registry mapping function names to implementations.
 */
export const toolsByName = {
  getTrumpetCallSchedule,
  getWawelTicketAvailability,
  getWawelPricing: getWawelTicketAvailability,
  getWawelPrices: getWawelTicketAvailability,
  recommendLocalDining
};

/**
 * Standard OpenAI / Ollama compatible function tool declarations.
 */
export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'getTrumpetCallSchedule',
      description: 'Returns the exact hourly occurrence, timing mechanics, and historical traditions of the Hejnał Mariacki (St. Mary\'s trumpet call played from the basilica tower).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWawelTicketAvailability',
      description: 'Checks official admission ticket prices, exhibition fees, live ticket availability, and remaining quotas for Wawel Royal Castle and Cathedral exhibitions. Invoke this tool whenever asked about Wawel prices, ticket costs, fees, admission rates, ticket counts, or availability.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Optional target date in YYYY-MM-DD format (e.g. 2026-10-15) or relative terms like "today" or "tomorrow". Defaults to "today" if omitted.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recommendLocalDining',
      description: 'Returns curated, traditional Kraków restaurant and food recommendations based on city district (Old Town, Kazimierz, Podgórze) and budget level (budget/milk bar, moderate, fine dining).',
      parameters: {
        type: 'object',
        properties: {
          district: {
            type: 'string',
            description: 'City district, e.g. "Old Town" (Stare Miasto), "Kazimierz" (Jewish Quarter), "Podgórze", or "Any".'
          },
          budget: {
            type: 'string',
            description: 'Budget tier: "budget" (or "milk bar"), "moderate" (sit-down traditional), or "fine dining" (high-end / Michelin-starred).'
          }
        },
        required: ['district', 'budget']
      }
    }
  }
];
