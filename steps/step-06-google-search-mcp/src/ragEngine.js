import fs from 'node:fs';
import path from 'node:path';

/**
 * Stop words in English and Polish to filter out during tokenization.
 */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we',
  'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where',
  'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
  'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  // Polish basic common stop words
  'i', 'w', 'na', 'z', 'do', 'ze', 'o', 'to', 'dla', 'jak', 'od', 'po', 'za', 'oraz', 'czy', 'co', 'jest',
  'sa', 'są', 'sie', 'się', 'przez', 'przy', 'ten', 'ta', 'te', 'tym', 'jego', 'jej', 'ich'
]);

/**
 * Static historical knowledge base covering core Kraków landmarks.
 */
const STATIC_HISTORICAL_CHUNKS = [
  {
    id: 'static-wawel-history-architecture',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'Wawel Royal Hill: Castle History & Renaissance Architecture',
    keywords: ['wawel', 'castle', 'royal', 'palace', 'kings', 'piast', 'jagiellonian', 'architecture', 'courtyard', 'arcades', 'berrecci', 'sigismund', 'renaissance'],
    content: `Wawel Royal Castle sits atop a limestone outcrop overlooking the Vistula (Wisła) River. For over five centuries (from 1038 until King Sigismund III Vasa transferred the royal court to Warsaw in 1596), Kraków served as Poland's capital and Wawel Castle stood as the epicentre of statehood, royal diplomacy, and intellectual life during the Polish Golden Age.
The castle represents a magnificent synthesis of Romanesque foundations, soaring Gothic additions (notably Casimir the Great's defensive fortifications), and sublime Italian High Renaissance reconstructions orchestrated between 1507 and 1536 under King Sigismund I the Old and Queen Bona Sforza. Tuscan master architects Francesco Fiorentino and Bartolomeo Berrecci designed the celebrated three-tiered Renaissance arcaded courtyard, famous for its elegant stone columns, delicate frescoes, and graceful proportions.`
  },
  {
    id: 'static-wawel-cathedral-bell',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'Wawel Royal Cathedral, Crypts & the Sigismund Bell',
    keywords: ['wawel', 'cathedral', 'royal crypts', 'tombs', 'coronation', 'sigismund bell', 'dzwon zygmunta', 'chapel', 'berrecci', 'kosciuszko', 'mickiewicz'],
    content: `The Cathedral Basilica of St. Stanislaus and St. Wenceslaus on Wawel Hill is Poland's national pantheon and the sacred sanctuary where 36 Polish monarchs were crowned and 17 kings are interred alongside national heroes and poets.
Key treasures include:
1. The Sigismund Chapel (Kaplica Zygmuntowska): Hailed as the 'Pearl of the Renaissance north of the Alps', commissioned by Sigismund I and designed by Bartolomeo Berrecci with a gilded dome and marble mausoleums.
2. The Royal Crypts: Resting place of legendary kings (including Casimir the Great, Władysław Jagiełło, Jan III Sobieski) and national liberators such as Tadeusz Kościuszko and Józef Piłsudski.
3. The Sigismund Bell (Dzwon Zygmunta): Cast in 1520 by Hans Beham of Nuremberg. Weighing 12.6 metric tonnes, the bell requires 12 bell-ringers to swing and is tolled exclusively during major national, ecclesiastical, and historical occasions.`
  },
  {
    id: 'static-wawel-dragon-legend',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'The Legend of the Wawel Dragon (Smok Wawelski) & Skuba the Cobbler',
    keywords: ['wawel', 'dragon', 'smok wawelski', 'legend', 'krak', 'skuba', 'cobbler', 'cave', 'statue', 'fire', 'vistula'],
    content: `The Legend of Smok Wawelski (the Wawel Dragon) is Kraków's most cherished mythological tale, chronicled in early Polish annals by Wincenty Kadłubek (12th-13th century). According to legend, a monstrous dragon inhabited a limestone cavern beneath Wawel Hill, terrorizing the settlement ruled by Prince Krak and demanding daily sacrifices of cattle or maidens.
Prince Krak promised his daughter's hand and his crown to whoever could slay the beast. While knights failed, a humble shoemaker's apprentice named Skuba devised an ingenious plan. He stuffed a ram's fleece with brimstone (sulfur) and pitch, leaving it outside the dragon's lair. The greedy dragon devoured the bait; the sulfur caught fire inside its stomach, creating unquenchable thirst. The monster drank water from the Vistula River until it burst. Today, visitors can explore the Dragon's Den (Smocza Jama) cavern and view the bronze dragon statue designed by Bronisław Chromy (1972) at the riverbank, which breathes real fire every few minutes.`
  },
  {
    id: 'static-st-marys-basilica-altar',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'St. Mary\'s Basilica (Kościół Mariacki) & The Veit Stoss Pentaptych Altar',
    keywords: ['st mary', 'mariacki', 'basilica', 'church', 'veit stoss', 'wit stwosz', 'altar', 'gothic', 'woodcarving', 'market square', 'rynek'],
    content: `The Church of Our Lady Assumed into Heaven (St. Mary's Basilica) is a monumental brick Gothic church commanding the north-eastern corner of Kraków's Main Market Square. Consecrated in 1320 and reconstructed following Mongol raids, the church is renowned for its magnificent polychrome interior painted by Jan Matejko and its monumental High Altar.
The Altarpiece of Veit Stoss (Ołtarz Wita Stwosza), created between 1477 and 1489 by Nuremberg sculptor Veit Stoss (Wit Stwosz), is the largest Gothic altarpiece in Europe (measuring 13 metres high by 11 metres wide). Carved from 500-year-old linden wood, the central panel depicts the Dormition and Assumption of the Virgin Mary surrounded by the Apostles. The figures, over 2.7 metres tall, are celebrated for their dramatic psychological realism, intricate drapery, and anatomical precision.`
  },
  {
    id: 'static-st-marys-towers-brothers-legend',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'The Unequal Towers of St. Mary\'s & The Murderous Brothers Legend',
    keywords: ['st mary', 'towers', 'unequal', 'brothers', 'legend', 'knife', 'murder', 'cloth hall', 'sukiennice', 'architecture'],
    content: `St. Mary's Basilica is immediately recognizable by its two distinctly asymmetrical towers. The taller northern tower (Hejnalica) rises 82 metres and features an elaborate late-Gothic octagonal spire topped with a gilded crown (added in 1666). The southern tower stands lower at 69 metres and houses the church bells.
According to legendary lore, the city council commissioned two architect brothers to construct the towers during the reign of King Bolesław the Chaste. As construction progressed, the elder brother realized his younger sibling's tower was rising higher and faster. Overcome with bitter jealousy, the elder brother murdered his brother with a knife. Wracked by guilt and remorse, he threw himself from the top of his finished tower to his death. To this day, the iron knife believed to have been used in the crime hangs beneath the Cloth Hall (Sukiennice) arcade facing the basilica.`
  },
  {
    id: 'static-hejnał-mariacki-history',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'The Hejnał Mariacki (St. Mary\'s Trumpet Call) Tradition & Mongol Siege',
    keywords: ['hejnał', 'hejnal', 'mariacki', 'trumpet', 'bugle', 'mongol', 'tatar', 'arrow', 'guard', 'tower', 'st mary'],
    content: `The Hejnał Mariacki is a traditional five-note bugle call played every hour on the hour from the highest balcony of the 82-metre tower of St. Mary's Basilica. The trumpeter sounds the melody four times, facing the four cardinal directions: south towards Wawel Castle for the King, west towards the Town Hall for the City Mayor, north towards the Florian Gate for guards and travelers, and east towards the Small Market Square for the Fire Department.
The signature musical characteristic of the Hejnał is its abrupt, sudden stop midway through the melody. This honors a 13th-century city watchman who spotted an invading horde of Mongol (Tatar) horsemen approaching Kraków during the 1241 siege. The guard sounded the alarm on his trumpet, giving the citizens time to close the city gates. Before he could complete the anthem, a Tatar archer shot an arrow that pierced his throat. The melody broke off instantly, and Kraków has preserved this historic mid-note silence for over seven centuries.`
  },
  {
    id: 'static-main-square-cloth-hall',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'Main Market Square (Rynek Główny) & The Cloth Hall (Sukiennice)',
    keywords: ['main square', 'rynek', 'glowny', 'cloth hall', 'sukiennice', 'town hall tower', 'adalbert', 'magdeburg', 'market'],
    content: `Laid out in 1257 pursuant to Magdeburg Law following the destruction of the 1241 Mongol invasion, Kraków's Main Market Square (Rynek Główny) is one of the largest medieval urban squares in Europe, measuring an expansive 200 by 200 metres (40,000 square meters).
At the square's center stands the Cloth Hall (Sukiennice), Europe's premier commercial hub throughout the Middle Ages, where international merchants traded Polish salt from Wieliczka, textiles, wax, amber, lead, and Hungarian wines. Rebuilt in Renaissance style with a picturesque attic parapet (attic crest with sculpted mascarons) after a 1555 fire, it now houses artisan amber stalls on the ground floor and the Gallery of 19th-Century Polish Art upstairs. The square also features the 70m Gothic Town Hall Tower (Wieża Ratuszowa) and the 11th-century pre-Romanesque Church of St. Adalbert (Kościół św. Wojciecha).`
  },
  {
    id: 'static-kazimierz-jewish-heritage',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'Kazimierz: Royal Charter, Jewish Quarter Heritage & Synagogues',
    keywords: ['kazimierz', 'jewish', 'quarter', 'casimir', 'synagogue', 'remah', 'old synagogue', 'tempel', 'plac nowy', 'culture'],
    content: `Located south of the Old Town, Kazimierz was founded in 1335 as a separate, chartered royal city by King Casimir III the Great (Kazimierz Wielki). In 1495, King Jan I Olbracht decreed that Kraków's Jewish population relocate to the northeastern district of Kazimierz, initiating a golden era where Jewish Kazimierz developed into one of Central and Eastern Europe's preeminent spiritual, scholarly, and cultural capitals.
Distinguished architectural landmarks include:
1. The Old Synagogue (Stara Synagoga): Poland's oldest preserved Jewish house of prayer, dating to the late 15th century, now an exhibition branch of the Museum of Kraków.
2. The Remah Synagogue and 16th-century Renaissance Jewish Cemetery: Named after the renowned philosopher and halakhic authority Rabbi Moses Isserles (the ReMA), whose tomb remains an international pilgrimage site.
3. The Tempel Synagogue: A 19th-century Moorish-revival synagogue celebrated for its stained glass and musical concerts.
4. Plac Nowy: The historic marketplace centered around the roundhouse (Okrąglak), renowned for antique flea markets and authentic Kraków zapiekanki (toasted open-face baguettes).`
  },
  {
    id: 'static-kazimierz-holocaust-revival',
    source: 'static:historical_corpus',
    layer: 'static',
    title: 'Kazimierz & Podgórze: WWII Ghetto History & Modern Cultural Revival',
    keywords: ['kazimierz', 'podgorze', 'ghetto', 'holocaust', 'schindler', 'factory', 'pankiewicz', 'jewish culture festival', 'revival'],
    content: `During World War II and the Nazi German occupation of Poland, Kraków's 65,000 Jewish residents were forcibly expelled from Kazimierz in March 1941 and confined within the walled Kraków Ghetto across the river in the Podgórze district. The tragic history of the ghetto liquidation in 1943 is memorialized at Plac Bohaterów Getta (Ghetto Heroes Square with its empty bronze chairs memorial) and the Eagle Pharmacy (Apteka Pod Orłem) operated by Tadeusz Pankiewicz, a Righteous Among the Nations. Nearby stands Oskar Schindler's Enamel Factory (Fabryka Emalia Oskara Schindlera), now a world-renowned historical museum.
Following decades of post-war neglect, Kazimierz experienced a profound cultural rebirth in the 1990s. Today, it stands as an energetic cultural district hosting the annual Jewish Culture Festival (Festiwal Kultury Żydowskiej), indie galleries, historic cafes, and traditional klezmer concerts.`
  }
];

/**
 * Tokenize a text string into an array of normalized search terms.
 * @param {string} text - Raw text to tokenize
 * @returns {string[]} Filtered lowercase tokens
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Split a markdown document into logical chunks based on headings (#, ##, ###).
 * @param {string} content - Markdown file content
 * @param {string} filename - Base filename for source attribution
 * @returns {Array<object>} Array of structured document chunks
 */
export function parseMarkdownToChunks(content, filename) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let currentTitle = filename.replace(/\.md$/i, '').replace(/_/g, ' ');
  let currentHeadingStack = [currentTitle];
  let currentBuffer = [];

  const flushChunk = () => {
    const body = currentBuffer.join('\n').trim();
    if (body.length > 20) {
      const fullTitle = currentHeadingStack.filter(Boolean).join(' > ');
      const tokens = tokenize(`${fullTitle} ${body}`);
      chunks.push({
        id: `mutable-${filename}-${chunks.length + 1}`,
        source: `data/mutable/${filename}`,
        layer: 'mutable',
        title: fullTitle,
        keywords: Array.from(new Set(tokens.slice(0, 20))),
        content: body
      });
    }
    currentBuffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushChunk();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      currentHeadingStack = currentHeadingStack.slice(0, level - 1);
      currentHeadingStack[level - 1] = headingText;
    } else {
      currentBuffer.push(line);
    }
  }

  flushChunk();
  return chunks;
}

/**
 * Custom dual-layer Local RAG Engine.
 * Combines hardcoded static historical data with real-time parsed markdown files.
 */
export class DualLocalRAGEngine {
  /**
   * @param {object} options
   * @param {string} options.mutableDir - Absolute or relative path to mutable markdown directory
   * @param {boolean} [options.enableCache] - Cache parsed mutable chunks based on file mtime
   */
  constructor(options = {}) {
    this.mutableDir = options.mutableDir || path.resolve(process.cwd(), 'data/mutable');
    this.enableCache = options.enableCache ?? true;
    this.fileCache = new Map(); // filename -> { mtimeMs, chunks }
    this.staticChunks = [...STATIC_HISTORICAL_CHUNKS];
  }

  /**
   * Read and parse all markdown files in the mutable directory with mtime checking.
   * @returns {Array<object>} All active mutable chunks
   */
  getMutableChunks() {
    const mutableChunks = [];

    try {
      if (!fs.existsSync(this.mutableDir)) {
        return [];
      }

      const files = fs.readdirSync(this.mutableDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(this.mutableDir, file);
        try {
          const stats = fs.statSync(filePath);
          const cached = this.fileCache.get(file);

          if (this.enableCache && cached && cached.mtimeMs === stats.mtimeMs) {
            mutableChunks.push(...cached.chunks);
          } else {
            const rawContent = fs.readFileSync(filePath, 'utf-8');
            const parsed = parseMarkdownToChunks(rawContent, file);
            this.fileCache.set(file, {
              mtimeMs: stats.mtimeMs,
              chunks: parsed
            });
            mutableChunks.push(...parsed);
          }
        } catch (fileErr) {
          console.error(`[RAGEngine] Error reading mutable file ${file}:`, fileErr.message);
        }
      }
    } catch (dirErr) {
      console.error(`[RAGEngine] Error scanning mutable directory ${this.mutableDir}:`, dirErr.message);
    }

    return mutableChunks;
  }

  /**
   * Return all combined chunks from static and mutable layers.
   * @returns {Array<object>}
   */
  getAllChunks() {
    const mutable = this.getMutableChunks();
    return [...this.staticChunks, ...mutable];
  }

  /**
   * Calculate relevance score between a query token set and a document chunk.
   * Employs TF-IDF weighting, heading match boosts, and exact phrase matching.
   * @param {string[]} queryTokens - Tokenized query
   * @param {string} rawQuery - Normalized raw query string
   * @param {object} chunk - Document chunk
   * @returns {number} Score from 0.0 to 100.0+
   */
  scoreChunk(queryTokens, rawQuery, chunk) {
    if (queryTokens.length === 0) return 0;

    let score = 0;
    const lowerTitle = chunk.title.toLowerCase();
    const lowerContent = chunk.content.toLowerCase();
    const chunkTokens = tokenize(`${chunk.title} ${chunk.content}`);
    const tokenFreqMap = new Map();

    for (const token of chunkTokens) {
      tokenFreqMap.set(token, (tokenFreqMap.get(token) || 0) + 1);
    }

    // Keyword and semantic term matches
    for (const qToken of queryTokens) {
      // Direct token match in body
      if (tokenFreqMap.has(qToken)) {
        const tf = tokenFreqMap.get(qToken);
        score += (1 + Math.log(tf)) * 2.0;
      }

      // High boost for title matches
      if (lowerTitle.includes(qToken)) {
        score += 5.0;
      }

      // Explicit keywords boost
      if (chunk.keywords && chunk.keywords.some(kw => kw.includes(qToken))) {
        score += 3.5;
      }

      // Substring match for inflected terms (e.g., 'wawelu' -> 'wawel')
      if (qToken.length >= 4 && lowerContent.includes(qToken.substring(0, qToken.length - 1))) {
        score += 0.8;
      }
    }

    // Exact raw query phrase bonus
    const cleanRaw = rawQuery.trim().toLowerCase();
    if (cleanRaw.length > 4 && lowerContent.includes(cleanRaw)) {
      score += 15.0;
    }
    if (cleanRaw.length > 4 && lowerTitle.includes(cleanRaw)) {
      score += 25.0;
    }

    // Prioritize mutable freshness slightly when queries contain price/hour/booking intent
    if (chunk.layer === 'mutable' && /(price|ticket|cost|hour|open|schedule|phone|contact|admission|zł|pln)/i.test(rawQuery)) {
      score *= 1.35;
    }

    return score;
  }

  /**
   * Search knowledge base for chunks most relevant to the query.
   * @param {string} query - User search question or topic
   * @param {object} [options]
   * @param {number} [options.topK=3] - Maximum number of chunks to return
   * @param {number} [options.minScore=0.5] - Minimum score threshold
   * @returns {Array<object>} Ranked relevant chunks
   */
  retrieve(query, options = {}) {
    const topK = options.topK ?? 3;
    const minScore = options.minScore ?? 0.5;

    if (!query || typeof query !== 'string') {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const allChunks = this.getAllChunks();
    const scoredChunks = allChunks.map(chunk => {
      const score = this.scoreChunk(queryTokens, query, chunk);
      return {
        ...chunk,
        score: Number(score.toFixed(3))
      };
    });

    const relevant = scoredChunks
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return relevant;
  }

  /**
   * Format retrieved knowledge into grounded markdown context for LLM prompt injection.
   * @param {string} query - User query
   * @param {number} [topK=3] - Maximum snippets to inject
   * @returns {{ contextText: string, sources: Array<{ id: string, title: string, source: string, layer: string, score: number }> }}
   */
  formatContextForPrompt(query, topK = 3) {
    const results = this.retrieve(query, { topK, minScore: 0.8 });

    if (results.length === 0) {
      return {
        contextText: 'No specific local archival context found for this query. Use core verified facts.',
        sources: []
      };
    }

    const sections = results.map((item, index) => {
      return `[Knowledge Source ${index + 1}: ${item.title} (${item.layer.toUpperCase()} - ${item.source})]\n${item.content}`;
    });

    return {
      contextText: sections.join('\n\n---\n\n'),
      sources: results.map(r => ({
        id: r.id,
        title: r.title,
        source: r.source,
        layer: r.layer,
        score: r.score
      }))
    };
  }

  /**
   * Get telemetry and statistics regarding the dual knowledge base.
   */
  getStats() {
    const mutable = this.getMutableChunks();
    return {
      staticChunkCount: this.staticChunks.length,
      mutableChunkCount: mutable.length,
      totalChunks: this.staticChunks.length + mutable.length,
      cachedFiles: Array.from(this.fileCache.keys()),
      mutableDirectory: this.mutableDir
    };
  }
}
