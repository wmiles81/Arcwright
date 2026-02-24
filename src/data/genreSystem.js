// Typical operating ranges per dimension per genre.
// These are NOT hard limits — they represent the band a dimension normally occupies.
// Values outside the range aren't "wrong," they're unusual for the genre.
// Used for guidance in scoring, validation hints, and UI display.
export const genreDimensionRanges = {
  romance: {
    intimacy:      [0, 9],    // full arc from strangers/enemies to deep connection
    powerDiff:     [-3, 3],   // moderate imbalances, rarely extreme
    infoAsym:      [0, 6],    // secrets exist but aren't the primary driver
    alignment:     [1, 9],    // starts misaligned, ends aligned
    proximity:     [2, 9],    // forced proximity is common, rarely zero
    vulnerability: [0, 8],    // key arc dimension, builds over time
    desire:        [0, 9],    // primary driver, full range
    stakes:        [1, 7],    // personal stakes, rarely world-ending
    trust:         [0, 9],    // core arc — broken/built over story
    danger:        [0, 5],    // low unless dark/suspense subgenre
    mystery:       [0, 4],    // not the primary driver
  },
  scienceFiction: {
    intimacy:      [0, 5],    // team bonding, rarely deep romance
    powerDiff:     [-4, 4],   // tech/political power gaps
    infoAsym:      [2, 9],    // always some unknown, rarely full knowledge
    alignment:     [1, 8],    // shifting alliances
    proximity:     [1, 8],    // ships, stations, forced proximity common
    vulnerability: [0, 6],    // characters are often competent, guarded
    desire:        [0, 4],    // professional/existential, rarely romantic
    stakes:        [3, 10],   // often high — civilizations, survival
    trust:         [1, 8],    // crew trust arcs
    danger:        [2, 9],    // baseline threat from environment/antagonist
    mystery:       [2, 9],    // discovery is a primary driver
  },
  fantasy: {
    intimacy:      [0, 6],    // fellowship bonding, sometimes romance
    powerDiff:     [-4, 5],   // magical power imbalances can be extreme
    infoAsym:      [1, 8],    // prophecies, hidden knowledge
    alignment:     [1, 9],    // quest alignment shifts
    proximity:     [1, 8],    // traveling party dynamics
    vulnerability: [0, 7],    // heroes exposed, but often armored (literally)
    desire:        [0, 5],    // quest goals more than romantic desire
    stakes:        [3, 10],   // world-ending stakes common
    trust:         [1, 9],    // fellowship trust, betrayal arcs
    danger:        [2, 10],   // constant environmental/antagonist threat
    mystery:       [1, 8],    // magical mysteries, lore discovery
  },
  mysteryThrillerSuspense: {
    intimacy:      [0, 4],    // professional relationships, rarely deep
    powerDiff:     [-3, 4],   // detective vs criminal, institutional power
    infoAsym:      [3, 10],   // THE primary driver — who knows what
    alignment:     [0, 7],    // shifting suspicion
    proximity:     [1, 7],    // investigation forces contact
    vulnerability: [1, 8],    // exposure to danger, being targeted
    desire:        [0, 4],    // desire for truth/justice, rarely romantic
    stakes:        [2, 9],    // life/death, justice
    trust:         [0, 7],    // everyone is a suspect
    danger:        [2, 9],    // persistent threat
    mystery:       [4, 10],   // THE defining dimension — always high
  },
  womensFiction: {
    intimacy:      [0, 6],    // friendship → mild romance, no spice
    powerDiff:     [-2, 2],   // minimal power imbalances
    infoAsym:      [0, 4],    // low secrets, mostly open communication
    alignment:     [3, 9],    // starts uncertain, ends aligned
    proximity:     [3, 8],    // small town/community forces connection
    vulnerability: [2, 8],    // emotional journey is key
    desire:        [0, 4],    // low romantic desire, more about belonging
    stakes:        [2, 6],    // personal/emotional, not life-threatening
    trust:         [2, 9],    // building trust with new community
    danger:        [0, 3],    // very low danger
    mystery:       [0, 3],    // minimal mystery
  },
};

export const genreSystem = {
  romance: {
    name: 'Romance',
    structure: 'romancingTheBeat',
    subgenres: {
      contemporary: {
        name: 'Contemporary Romance',
        weights: { infoAsym: 0.6, stakes: 0.8, misalignment: 1.0, powerDiff: 0.4, vulnerabilityTrust: 1.2, desireIntimacy: 1.0, proximityTrust: 0.5, danger: 0.3, mystery: 0.4 },
        requirements: { finalIntimacy: [8, 10], finalTrust: [7, 10], finalTension: [0, 3] },
        modifiers: ['Small Town', 'Big City', 'Workplace', 'Second Chance', 'Fake Relationship'],
      },
      darkRomance: {
        name: 'Dark Romance',
        weights: { infoAsym: 1.0, stakes: 1.5, misalignment: 0.7, powerDiff: 1.2, vulnerabilityTrust: 1.0, desireIntimacy: 0.8, proximityTrust: 0.9, danger: 1.3, mystery: 0.8 },
        requirements: { finalIntimacy: [7, 10], finalTrust: [5, 9], finalTension: [4, 8] },
        modifiers: ['Mafia', 'Captive', 'Stalker', 'Revenge', 'Morally Grey'],
      },
      serialKillerRomance: {
        name: 'Serial Killer Romance',
        weights: { infoAsym: 1.5, stakes: 2.0, misalignment: 1.0, powerDiff: 1.3, vulnerabilityTrust: 1.4, desireIntimacy: 1.1, proximityTrust: 1.2, danger: 1.8, mystery: 1.4 },
        requirements: { finalIntimacy: [7, 10], finalTrust: [4, 8], finalTension: [6, 9] },
        modifiers: ['FBI Agent', 'Profiler', 'True Crime Writer', 'Vigilante', 'Partners in Crime'],
      },
      paranormal: {
        name: 'Paranormal Romance',
        weights: { infoAsym: 1.0, stakes: 1.3, misalignment: 0.9, powerDiff: 0.8, vulnerabilityTrust: 1.0, desireIntimacy: 0.9, proximityTrust: 0.7, danger: 1.0, mystery: 1.1 },
        requirements: { finalIntimacy: [8, 10], finalTrust: [7, 10], finalTension: [2, 5] },
        modifiers: ['Vampire', 'Shifter', 'Fae', 'Witch', 'Ghost'],
      },
      romanticSuspense: {
        name: 'Romantic Suspense',
        weights: { infoAsym: 1.8, stakes: 1.6, misalignment: 1.1, powerDiff: 0.7, vulnerabilityTrust: 1.1, desireIntimacy: 0.8, proximityTrust: 0.9, danger: 1.5, mystery: 1.6 },
        requirements: { finalIntimacy: [7, 10], finalTrust: [7, 10], finalTension: [1, 4] },
        modifiers: ['Suspense', 'Thriller', 'Bodyguard', 'Witness Protection', 'On the Run'],
      },
    },
  },
  scienceFiction: {
    name: 'Science Fiction',
    structure: 'heroJourney',
    subgenres: {
      spaceOpera: {
        name: 'Space Opera',
        weights: { infoAsym: 0.9, stakes: 1.5, misalignment: 1.0, powerDiff: 0.8, vulnerabilityTrust: 0.7, desireIntimacy: 0.3, proximityTrust: 0.6, danger: 1.4, mystery: 1.0 },
        requirements: { finalIntimacy: [0, 5], finalTrust: [6, 10], finalTension: [2, 6] },
        modifiers: ['Technology Driven', 'Political Intrigue', 'Alien Contact', 'Empire Building', 'Space Combat'],
      },
      cyberpunk: {
        name: 'Cyberpunk',
        weights: { infoAsym: 1.6, stakes: 1.3, misalignment: 1.2, powerDiff: 1.4, vulnerabilityTrust: 1.0, desireIntimacy: 0.4, proximityTrust: 0.8, danger: 1.5, mystery: 1.3 },
        requirements: { finalIntimacy: [0, 4], finalTrust: [3, 7], finalTension: [5, 8] },
        modifiers: ['Corporate Dystopia', 'AI/Cyberspace', 'Body Modification', 'Hacker Culture', 'Urban Decay'],
      },
      hardSF: {
        name: 'Hard Science Fiction',
        weights: { infoAsym: 1.2, stakes: 1.4, misalignment: 0.8, powerDiff: 0.5, vulnerabilityTrust: 0.6, desireIntimacy: 0.2, proximityTrust: 0.5, danger: 1.2, mystery: 1.5 },
        requirements: { finalIntimacy: [0, 3], finalTrust: [7, 10], finalTension: [1, 4] },
        modifiers: ['Hard Science', 'Near Future', 'First Contact', 'Colonization', 'Scientific Discovery'],
      },
    },
  },
  fantasy: {
    name: 'Fantasy',
    structure: 'heroJourney',
    subgenres: {
      epicFantasy: {
        name: 'Epic Fantasy',
        weights: { infoAsym: 1.0, stakes: 1.8, misalignment: 1.1, powerDiff: 1.0, vulnerabilityTrust: 0.8, desireIntimacy: 0.3, proximityTrust: 0.7, danger: 1.5, mystery: 1.0 },
        requirements: { finalIntimacy: [0, 5], finalTrust: [7, 10], finalTension: [3, 7] },
        modifiers: ['Quest', 'Prophecy', 'Coming of Age', 'War', 'Magic System'],
      },
      urbanFantasy: {
        name: 'Urban Fantasy',
        weights: { infoAsym: 1.3, stakes: 1.2, misalignment: 0.9, powerDiff: 0.9, vulnerabilityTrust: 0.9, desireIntimacy: 0.5, proximityTrust: 0.8, danger: 1.3, mystery: 1.4 },
        requirements: { finalIntimacy: [0, 6], finalTrust: [6, 9], finalTension: [4, 7] },
        modifiers: ['Modern Setting', 'Supernatural Creatures', 'Hidden World', 'Detective', 'Gang Warfare'],
      },
      darkFantasy: {
        name: 'Dark Fantasy',
        weights: { infoAsym: 1.4, stakes: 1.6, misalignment: 1.3, powerDiff: 1.2, vulnerabilityTrust: 1.1, desireIntimacy: 0.4, proximityTrust: 0.9, danger: 1.7, mystery: 1.2 },
        requirements: { finalIntimacy: [0, 4], finalTrust: [4, 8], finalTension: [6, 9] },
        modifiers: ['Grimdark', 'Morally Grey', 'Horror Elements', 'Anti-Hero', 'Corruption'],
      },
    },
  },
  mysteryThrillerSuspense: {
    name: 'Mystery/Thriller/Suspense',
    structure: 'mysterySuspense',
    subgenres: {
      cozyMystery: {
        name: 'Cozy Mystery',
        weights: { infoAsym: 1.5, stakes: 0.7, misalignment: 0.6, powerDiff: 0.4, vulnerabilityTrust: 0.5, desireIntimacy: 0.3, proximityTrust: 0.4, danger: 0.6, mystery: 1.8 },
        requirements: { finalIntimacy: [0, 4], finalTrust: [7, 10], finalTension: [0, 2] },
        modifiers: ['Amateur Sleuth', 'Small Town', 'Culinary', 'Pet Detective', 'Craft/Hobby'],
      },
      psychologicalThriller: {
        name: 'Psychological Thriller',
        weights: { infoAsym: 1.8, stakes: 1.6, misalignment: 1.4, powerDiff: 1.1, vulnerabilityTrust: 1.5, desireIntimacy: 0.4, proximityTrust: 0.9, danger: 1.4, mystery: 1.7 },
        requirements: { finalIntimacy: [0, 3], finalTrust: [2, 6], finalTension: [7, 10] },
        modifiers: ['Unreliable Narrator', 'Mind Games', 'Domestic Suspense', 'Gaslighting', 'Paranoia'],
      },
      hardboiledDetective: {
        name: 'Hardboiled Detective',
        weights: { infoAsym: 1.4, stakes: 1.3, misalignment: 1.0, powerDiff: 0.8, vulnerabilityTrust: 0.9, desireIntimacy: 0.4, proximityTrust: 0.7, danger: 1.5, mystery: 1.5 },
        requirements: { finalIntimacy: [0, 4], finalTrust: [5, 8], finalTension: [4, 7] },
        modifiers: ['Noir', 'Urban', 'Private Eye', 'Corruption', 'Cynical'],
      },
    },
  },
  womensFiction: {
    name: "Women's Fiction",
    structure: 'womensFiction',
    subgenres: {
      smallTown: {
        name: 'Small Town',
        weights: { infoAsym: 0.4, stakes: 0.6, misalignment: 0.5, powerDiff: 0.3, vulnerabilityTrust: 1.2, desireIntimacy: 0.5, proximityTrust: 1.0, danger: 0.2, mystery: 0.3 },
        requirements: { finalIntimacy: [4, 7], finalTrust: [7, 10], finalTension: [0, 2] },
        modifiers: ['Bakery/Café', 'Holiday', 'Family Business', 'Seasonal', 'Festival'],
      },
      returningHome: {
        name: 'Returning Home',
        weights: { infoAsym: 0.5, stakes: 0.7, misalignment: 0.6, powerDiff: 0.3, vulnerabilityTrust: 1.3, desireIntimacy: 0.4, proximityTrust: 0.9, danger: 0.2, mystery: 0.4 },
        requirements: { finalIntimacy: [4, 7], finalTrust: [7, 10], finalTension: [0, 2] },
        modifiers: ['Family Estate', 'Childhood Sweetheart', 'Old Wounds', 'Legacy', 'Reconciliation'],
      },
      freshStart: {
        name: 'Fresh Start',
        weights: { infoAsym: 0.5, stakes: 0.8, misalignment: 0.7, powerDiff: 0.4, vulnerabilityTrust: 1.4, desireIntimacy: 0.5, proximityTrust: 1.1, danger: 0.3, mystery: 0.3 },
        requirements: { finalIntimacy: [4, 7], finalTrust: [7, 10], finalTension: [0, 3] },
        modifiers: ['Divorce Recovery', 'Career Change', 'Widowed', 'New City', 'Starting Over'],
      },
      familySaga: {
        name: 'Family Saga',
        weights: { infoAsym: 0.6, stakes: 0.9, misalignment: 0.8, powerDiff: 0.5, vulnerabilityTrust: 1.2, desireIntimacy: 0.4, proximityTrust: 0.8, danger: 0.3, mystery: 0.5 },
        requirements: { finalIntimacy: [3, 6], finalTrust: [6, 9], finalTension: [1, 4] },
        modifiers: ['Multi-generational', 'Inheritance', 'Family Secrets', 'Reunion', 'Matriarch'],
      },
    },
  },
};
