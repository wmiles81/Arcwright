import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const UniversalNarrativeAnalyzer = () => {
  const dimensions = {
    intimacy: { name: 'Intimacy', color: '#e91e63', range: [0, 10] },           // Hot Pink
    powerDiff: { name: 'Power Differential', color: '#ff6f00', range: [-5, 5] }, // Deep Orange
    infoAsym: { name: 'Info Asymmetry', color: '#ffd600', range: [0, 10] },     // Bright Yellow
    alignment: { name: 'Goal Alignment', color: '#76ff03', range: [0, 10] },    // Lime Green
    proximity: { name: 'Physical Proximity', color: '#00e5ff', range: [0, 10] }, // Cyan
    vulnerability: { name: 'Vulnerability', color: '#2979ff', range: [0, 10] },  // Blue
    desire: { name: 'Desire/Attraction', color: '#d500f9', range: [0, 10] },    // Purple/Magenta
    stakes: { name: 'Stakes', color: '#ff1744', range: [0, 10] },               // Red
    trust: { name: 'Trust', color: '#00e676', range: [0, 10] },                 // Green
    danger: { name: 'Danger/Threat', color: '#651fff', range: [0, 10] },        // Deep Purple
    mystery: { name: 'Mystery/Unknown', color: '#1de9b6', range: [0, 10] },     // Teal
  };

  // Plot Structures
  const plotStructures = {
    romancingTheBeat: {
      name: 'Romancing the Beat',
      beats: {
        setup: { name: 'Setup', range: [0, 10], color: '#64748b' },
        meetCute: { name: 'Meet Cute', range: [10, 10], color: '#db2777' },
        noWay: { name: 'No Way', range: [10, 20], color: '#fb923c' },
        connection: { name: 'Connection', range: [20, 50], color: '#4ade80' },
        midpoint: { name: 'Midpoint', range: [50, 50], color: '#c084fc' },
        retreat: { name: 'Retreat', range: [50, 65], color: '#22d3ee' },
        blackMoment: { name: 'Black Moment', range: [65, 75], color: '#b91c1c' },
        epiphany: { name: 'Epiphany', range: [75, 85], color: '#fb7185' },
        grandGesture: { name: 'Grand Gesture', range: [85, 90], color: '#d8b4fe' },
        hea: { name: 'HEA', range: [90, 100], color: '#86efac' },
      }
    },
    heroJourney: {
      name: "Hero's Journey",
      beats: {
        ordinaryWorld: { name: 'Ordinary World', range: [0, 8], color: '#64748b' },
        callToAdventure: { name: 'Call to Adventure', range: [8, 12], color: '#60a5fa' },
        refusalOfCall: { name: 'Refusal of Call', range: [12, 15], color: '#818cf8' },
        meetingMentor: { name: 'Meeting Mentor', range: [15, 20], color: '#c084fc' },
        crossingThreshold: { name: 'Crossing Threshold', range: [20, 25], color: '#d8b4fe' },
        testsAlliesEnemies: { name: 'Tests/Allies/Enemies', range: [25, 50], color: '#4ade80' },
        approachInmostCave: { name: 'Approach Inmost Cave', range: [50, 55], color: '#fb923c' },
        ordeal: { name: 'Ordeal', range: [55, 65], color: '#b91c1c' },
        reward: { name: 'Reward', range: [65, 70], color: '#fcd34d' },
        roadBack: { name: 'Road Back', range: [70, 80], color: '#22d3ee' },
        resurrection: { name: 'Resurrection', range: [80, 90], color: '#f87171' },
        returnWithElixir: { name: 'Return with Elixir', range: [90, 100], color: '#86efac' },
      }
    },
    threeAct: {
      name: 'Three Act Structure',
      beats: {
        setup: { name: 'Act I: Setup', range: [0, 25], color: '#60a5fa' },
        incitingIncident: { name: 'Inciting Incident', range: [10, 15], color: '#c084fc' },
        firstPlotPoint: { name: 'First Plot Point', range: [25, 25], color: '#d8b4fe' },
        risingAction: { name: 'Act II: Rising Action', range: [25, 50], color: '#4ade80' },
        midpoint: { name: 'Midpoint', range: [50, 50], color: '#fb923c' },
        crisis: { name: 'Crisis/Complications', range: [50, 75], color: '#b91c1c' },
        secondPlotPoint: { name: 'Second Plot Point', range: [75, 75], color: '#f87171' },
        climax: { name: 'Act III: Climax', range: [75, 90], color: '#9333ea' },
        resolution: { name: 'Resolution', range: [90, 100], color: '#86efac' },
      }
    },
    mysterySuspense: {
      name: 'Mystery/Suspense Structure',
      beats: {
        ordinaryWorld: { name: 'Ordinary World', range: [0, 8], color: '#64748b' },
        crime: { name: 'Crime/Inciting Incident', range: [8, 12], color: '#b91c1c' },
        initialInvestigation: { name: 'Initial Investigation', range: [12, 25], color: '#60a5fa' },
        firstTwist: { name: 'First Twist', range: [25, 30], color: '#c084fc' },
        deeperInvestigation: { name: 'Deeper Investigation', range: [30, 50], color: '#4ade80' },
        midpointRevelation: { name: 'Midpoint Revelation', range: [50, 55], color: '#fb923c' },
        falseResolution: { name: 'False Resolution', range: [55, 65], color: '#d8b4fe' },
        darkestMoment: { name: 'Darkest Moment', range: [65, 75], color: '#9333ea' },
        finalClues: { name: 'Final Clues', range: [75, 85], color: '#fcd34d' },
        climaxReveal: { name: 'Climax & Reveal', range: [85, 95], color: '#f87171' },
        denouement: { name: 'Denouement', range: [95, 100], color: '#86efac' },
      }
    },
  };

  // Genre Taxonomy
  const genreSystem = {
    romance: {
      name: 'Romance',
      structure: 'romancingTheBeat',
      subgenres: {
        contemporary: {
          name: 'Contemporary Romance',
          weights: { infoAsym: 0.6, stakes: 0.8, misalignment: 1.0, powerDiff: 0.4, vulnerabilityTrust: 1.2, desireIntimacy: 1.0, proximityTrust: 0.5, danger: 0.3, mystery: 0.4 },
          requirements: { finalIntimacy: [8, 10], finalTrust: [7, 10], finalTension: [0, 3] },
          modifiers: ['Small Town', 'Big City', 'Workplace', 'Second Chance', 'Fake Relationship']
        },
        darkRomance: {
          name: 'Dark Romance',
          weights: { infoAsym: 1.0, stakes: 1.5, misalignment: 0.7, powerDiff: 1.2, vulnerabilityTrust: 1.0, desireIntimacy: 0.8, proximityTrust: 0.9, danger: 1.3, mystery: 0.8 },
          requirements: { finalIntimacy: [7, 10], finalTrust: [5, 9], finalTension: [4, 8] },
          modifiers: ['Mafia', 'Captive', 'Stalker', 'Revenge', 'Morally Grey']
        },
        serialKillerRomance: {
          name: 'Serial Killer Romance',
          weights: { infoAsym: 1.5, stakes: 2.0, misalignment: 1.0, powerDiff: 1.3, vulnerabilityTrust: 1.4, desireIntimacy: 1.1, proximityTrust: 1.2, danger: 1.8, mystery: 1.4 },
          requirements: { finalIntimacy: [7, 10], finalTrust: [4, 8], finalTension: [6, 9] },
          modifiers: ['FBI Agent', 'Profiler', 'True Crime Writer', 'Vigilante', 'Partners in Crime']
        },
        paranormal: {
          name: 'Paranormal Romance',
          weights: { infoAsym: 1.0, stakes: 1.3, misalignment: 0.9, powerDiff: 0.8, vulnerabilityTrust: 1.0, desireIntimacy: 0.9, proximityTrust: 0.7, danger: 1.0, mystery: 1.1 },
          requirements: { finalIntimacy: [8, 10], finalTrust: [7, 10], finalTension: [2, 5] },
          modifiers: ['Vampire', 'Shifter', 'Fae', 'Witch', 'Ghost']
        },
        romanticSuspense: {
          name: 'Romantic Suspense',
          weights: { infoAsym: 1.8, stakes: 1.6, misalignment: 1.1, powerDiff: 0.7, vulnerabilityTrust: 1.1, desireIntimacy: 0.8, proximityTrust: 0.9, danger: 1.5, mystery: 1.6 },
          requirements: { finalIntimacy: [7, 10], finalTrust: [7, 10], finalTension: [1, 4] },
          modifiers: ['Suspense', 'Thriller', 'Bodyguard', 'Witness Protection', 'On the Run']
        },
      }
    },
    scienceFiction: {
      name: 'Science Fiction',
      structure: 'heroJourney',
      subgenres: {
        spaceOpera: {
          name: 'Space Opera',
          weights: { infoAsym: 0.9, stakes: 1.5, misalignment: 1.0, powerDiff: 0.8, vulnerabilityTrust: 0.7, desireIntimacy: 0.3, proximityTrust: 0.6, danger: 1.4, mystery: 1.0 },
          requirements: { finalIntimacy: [0, 5], finalTrust: [6, 10], finalTension: [2, 6] },
          modifiers: ['Technology Driven', 'Political Intrigue', 'Alien Contact', 'Empire Building', 'Space Combat']
        },
        cyberpunk: {
          name: 'Cyberpunk',
          weights: { infoAsym: 1.6, stakes: 1.3, misalignment: 1.2, powerDiff: 1.4, vulnerabilityTrust: 1.0, desireIntimacy: 0.4, proximityTrust: 0.8, danger: 1.5, mystery: 1.3 },
          requirements: { finalIntimacy: [0, 4], finalTrust: [3, 7], finalTension: [5, 8] },
          modifiers: ['Corporate Dystopia', 'AI/Cyberspace', 'Body Modification', 'Hacker Culture', 'Urban Decay']
        },
        hardSF: {
          name: 'Hard Science Fiction',
          weights: { infoAsym: 1.2, stakes: 1.4, misalignment: 0.8, powerDiff: 0.5, vulnerabilityTrust: 0.6, desireIntimacy: 0.2, proximityTrust: 0.5, danger: 1.2, mystery: 1.5 },
          requirements: { finalIntimacy: [0, 3], finalTrust: [7, 10], finalTension: [1, 4] },
          modifiers: ['Hard Science', 'Near Future', 'First Contact', 'Colonization', 'Scientific Discovery']
        },
      }
    },
    fantasy: {
      name: 'Fantasy',
      structure: 'heroJourney',
      subgenres: {
        epicFantasy: {
          name: 'Epic Fantasy',
          weights: { infoAsym: 1.0, stakes: 1.8, misalignment: 1.1, powerDiff: 1.0, vulnerabilityTrust: 0.8, desireIntimacy: 0.3, proximityTrust: 0.7, danger: 1.5, mystery: 1.0 },
          requirements: { finalIntimacy: [0, 5], finalTrust: [7, 10], finalTension: [3, 7] },
          modifiers: ['Quest', 'Prophecy', 'Coming of Age', 'War', 'Magic System']
        },
        urbanFantasy: {
          name: 'Urban Fantasy',
          weights: { infoAsym: 1.3, stakes: 1.2, misalignment: 0.9, powerDiff: 0.9, vulnerabilityTrust: 0.9, desireIntimacy: 0.5, proximityTrust: 0.8, danger: 1.3, mystery: 1.4 },
          requirements: { finalIntimacy: [0, 6], finalTrust: [6, 9], finalTension: [4, 7] },
          modifiers: ['Modern Setting', 'Supernatural Creatures', 'Hidden World', 'Detective', 'Gang Warfare']
        },
        darkFantasy: {
          name: 'Dark Fantasy',
          weights: { infoAsym: 1.4, stakes: 1.6, misalignment: 1.3, powerDiff: 1.2, vulnerabilityTrust: 1.1, desireIntimacy: 0.4, proximityTrust: 0.9, danger: 1.7, mystery: 1.2 },
          requirements: { finalIntimacy: [0, 4], finalTrust: [4, 8], finalTension: [6, 9] },
          modifiers: ['Grimdark', 'Morally Grey', 'Horror Elements', 'Anti-Hero', 'Corruption']
        },
      }
    },
    mysteryThrillerSuspense: {
      name: 'Mystery/Thriller/Suspense',
      structure: 'mysterySuspense',
      subgenres: {
        cozyMystery: {
          name: 'Cozy Mystery',
          weights: { infoAsym: 1.5, stakes: 0.7, misalignment: 0.6, powerDiff: 0.4, vulnerabilityTrust: 0.5, desireIntimacy: 0.3, proximityTrust: 0.4, danger: 0.6, mystery: 1.8 },
          requirements: { finalIntimacy: [0, 4], finalTrust: [7, 10], finalTension: [0, 2] },
          modifiers: ['Amateur Sleuth', 'Small Town', 'Culinary', 'Pet Detective', 'Craft/Hobby']
        },
        psychologicalThriller: {
          name: 'Psychological Thriller',
          weights: { infoAsym: 1.8, stakes: 1.6, misalignment: 1.4, powerDiff: 1.1, vulnerabilityTrust: 1.5, desireIntimacy: 0.4, proximityTrust: 0.9, danger: 1.4, mystery: 1.7 },
          requirements: { finalIntimacy: [0, 3], finalTrust: [2, 6], finalTension: [7, 10] },
          modifiers: ['Unreliable Narrator', 'Mind Games', 'Domestic Suspense', 'Gaslighting', 'Paranoia']
        },
        hardboiledDetective: {
          name: 'Hardboiled Detective',
          weights: { infoAsym: 1.4, stakes: 1.3, misalignment: 1.0, powerDiff: 0.8, vulnerabilityTrust: 0.9, desireIntimacy: 0.4, proximityTrust: 0.7, danger: 1.5, mystery: 1.5 },
          requirements: { finalIntimacy: [0, 4], finalTrust: [5, 8], finalTension: [4, 7] },
          modifiers: ['Noir', 'Urban', 'Private Eye', 'Corruption', 'Cynical']
        },
      }
    },
  };

  const [selectedGenre, setSelectedGenre] = useState('romance');
  const [selectedSubgenre, setSelectedSubgenre] = useState('contemporary');
  const [selectedModifier, setSelectedModifier] = useState('');
  
  // Genre-appropriate default visible dimensions
  const getDefaultVisibleDims = (genre) => {
    // Start with all dimensions false
    const allDimsFalse = Object.keys(dimensions).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, { tension: false });
    
    const genreSpecific = {
      romance: {
        intimacy: true,
        desire: true,
        vulnerability: true,
        trust: true,
        stakes: true,
        tension: true,
      },
      scienceFiction: {
        danger: true,
        mystery: true,
        stakes: true,
        trust: true,
        alignment: true,
        infoAsym: true,
        tension: true,
      },
      fantasy: {
        danger: true,
        mystery: true,
        stakes: true,
        trust: true,
        alignment: true,
        vulnerability: true,
        tension: true,
      },
      mysteryThrillerSuspense: {
        mystery: true,
        infoAsym: true,
        danger: true,
        stakes: true,
        trust: true,
        vulnerability: true,
        tension: true,
      },
    };
    
    // Merge: start with all false, then override with genre-specific trues
    return { ...allDimsFalse, ...(genreSpecific[genre] || genreSpecific.romance) };
  };
  
  const [visibleDims, setVisibleDims] = useState(getDefaultVisibleDims('romance'));

  const currentGenre = genreSystem[selectedGenre];
  const currentSubgenre = currentGenre.subgenres[selectedSubgenre];
  const currentStructure = plotStructures[currentGenre.structure];
  
  // Ensure all dimension keys have weights (default to 0 if not specified)
  const getCompleteWeights = (subgenreWeights) => {
    const complete = { ...subgenreWeights };
    Object.keys(dimensions).forEach(key => {
      if (complete[key] === undefined) {
        complete[key] = 0;
      }
    });
    return complete;
  };
  
  const [weights, setWeights] = useState(getCompleteWeights(currentSubgenre.weights));
  const [baseWeights, setBaseWeights] = useState(getCompleteWeights(currentSubgenre.weights));

  // Modifier effects - adjust weights based on focus
  const modifierEffects = {
    // Romance modifiers
    'Small Town': { description: 'Increased proximity, community pressure', adjustments: { proximityTrust: 1.3, alignment: 1.2 } },
    'Big City': { description: 'Lower proximity, higher independence', adjustments: { proximityTrust: 0.7, powerDiff: 0.8 } },
    'Workplace': { description: 'Forced proximity, power dynamics', adjustments: { proximityTrust: 1.4, powerDiff: 1.3 } },
    'Second Chance': { description: 'High vulnerability, trust issues', adjustments: { vulnerabilityTrust: 1.5, infoAsym: 1.2 } },
    'Fake Relationship': { description: 'Deception, gradual truth reveals', adjustments: { infoAsym: 1.4, desireIntimacy: 1.3 } },
    'Mafia': { description: 'Extreme danger, loyalty conflicts', adjustments: { danger: 1.6, stakes: 1.4, powerDiff: 1.5 } },
    'Captive': { description: 'Maximum power imbalance, forced proximity', adjustments: { powerDiff: 1.8, proximityTrust: 1.6, danger: 1.4 } },
    'Stalker': { description: 'Info asymmetry, psychological tension', adjustments: { infoAsym: 1.7, danger: 1.5, vulnerabilityTrust: 1.4 } },
    'Revenge': { description: 'High stakes, goal misalignment initially', adjustments: { stakes: 1.5, misalignment: 1.4, danger: 1.3 } },
    'Morally Grey': { description: 'Trust challenges, moral complexity', adjustments: { vulnerabilityTrust: 1.4, infoAsym: 1.3, stakes: 1.3 } },
    // Science Fiction modifiers
    'Technology Driven': { description: 'AI, tech focus, innovation', adjustments: { mystery: 1.3, infoAsym: 1.2 } },
    'Political Intrigue': { description: 'Power struggles, conspiracies', adjustments: { infoAsym: 1.5, powerDiff: 1.3, misalignment: 1.2 } },
    'Alien Contact': { description: 'First contact, unknown threats', adjustments: { mystery: 1.6, danger: 1.3, infoAsym: 1.3 } },
    'Space Combat': { description: 'Military action, survival', adjustments: { danger: 1.6, stakes: 1.4 } },
    // Fantasy modifiers  
    'Quest': { description: 'Journey structure, clear goal', adjustments: { alignment: 1.4, stakes: 1.3 } },
    'War': { description: 'Large-scale conflict, sacrifice', adjustments: { danger: 1.6, stakes: 1.5, alignment: 1.2 } },
    'Grimdark': { description: 'Moral ambiguity, suffering', adjustments: { danger: 1.5, vulnerabilityTrust: 1.4, stakes: 1.4 } },
    // Mystery modifiers
    'Unreliable Narrator': { description: 'Reality questioning, deception', adjustments: { infoAsym: 1.8, mystery: 1.5, vulnerabilityTrust: 1.4 } },
    'Mind Games': { description: 'Psychological manipulation', adjustments: { infoAsym: 1.5, vulnerabilityTrust: 1.5, mystery: 1.3 } },
    'Noir': { description: 'Cynical, atmospheric', adjustments: { danger: 1.3, misalignment: 1.2, vulnerabilityTrust: 1.2 } },
  };

  const getModifierAdjustedWeights = () => {
    if (!selectedModifier || !modifierEffects[selectedModifier]) {
      return weights;
    }
    
    const adjustments = modifierEffects[selectedModifier].adjustments;
    const adjusted = { ...weights };
    
    // Apply multipliers from modifier
    Object.entries(adjustments).forEach(([key, multiplier]) => {
      if (adjusted[key] !== undefined) {
        adjusted[key] = weights[key] * multiplier;
      }
    });
    
    return adjusted;
  };

  // Sample arcs - genre-specific
  const presetArcs = {
    romance: [
      { time: 5, beat: 'setup', label: 'Opening Image', intimacy: 0, powerDiff: 0, infoAsym: 2, alignment: 5, proximity: 3, vulnerability: 1, desire: 0, stakes: 2, trust: 3, danger: 1, mystery: 2 },
      { time: 10, beat: 'meetCute', label: 'Meet Cute (Hostile)', intimacy: 1, powerDiff: 0, infoAsym: 3, alignment: 2, proximity: 5, vulnerability: 2, desire: 4, stakes: 3, trust: 1, danger: 2, mystery: 3 },
      { time: 15, beat: 'noWay', label: 'Forced Together', intimacy: 2, powerDiff: 1, infoAsym: 4, alignment: 2, proximity: 7, vulnerability: 3, desire: 5, stakes: 4, trust: 1, danger: 3, mystery: 4 },
      { time: 25, beat: 'connection', label: 'Sparks Fly', intimacy: 3, powerDiff: 0, infoAsym: 5, alignment: 3, proximity: 8, vulnerability: 4, desire: 6, stakes: 5, trust: 2, danger: 4, mystery: 5 },
      { time: 35, beat: 'connection', label: 'Growing Closer', intimacy: 5, powerDiff: 0, infoAsym: 5, alignment: 5, proximity: 9, vulnerability: 6, desire: 7, stakes: 5, trust: 4, danger: 4, mystery: 4 },
      { time: 50, beat: 'midpoint', label: 'Midpoint Kiss/Commit', intimacy: 7, powerDiff: 0, infoAsym: 6, alignment: 6, proximity: 10, vulnerability: 8, desire: 8, stakes: 6, trust: 6, danger: 5, mystery: 5 },
      { time: 58, beat: 'retreat', label: 'Doubt Creeps In', intimacy: 6, powerDiff: 0, infoAsym: 7, alignment: 4, proximity: 7, vulnerability: 7, desire: 8, stakes: 7, trust: 5, danger: 6, mystery: 7 },
      { time: 70, beat: 'blackMoment', label: 'Black Moment', intimacy: 2, powerDiff: -2, infoAsym: 9, alignment: 1, proximity: 2, vulnerability: 9, desire: 9, stakes: 10, trust: 2, danger: 8, mystery: 8 },
      { time: 80, beat: 'epiphany', label: 'Epiphany', intimacy: 4, powerDiff: 0, infoAsym: 6, alignment: 6, proximity: 5, vulnerability: 9, desire: 9, stakes: 8, trust: 5, danger: 6, mystery: 5 },
      { time: 88, beat: 'grandGesture', label: 'Grand Gesture', intimacy: 7, powerDiff: 0, infoAsym: 3, alignment: 8, proximity: 9, vulnerability: 9, desire: 9, stakes: 6, trust: 8, danger: 3, mystery: 2 },
      { time: 100, beat: 'hea', label: 'HEA', intimacy: 9, powerDiff: 0, infoAsym: 1, alignment: 9, proximity: 10, vulnerability: 8, desire: 9, stakes: 2, trust: 9, danger: 1, mystery: 1 },
    ],
    scienceFiction: [
      { time: 4, beat: 'ordinaryWorld', label: 'Ordinary World', intimacy: 2, powerDiff: 0, infoAsym: 2, alignment: 6, proximity: 5, vulnerability: 2, desire: 1, stakes: 2, trust: 5, danger: 2, mystery: 3 },
      { time: 10, beat: 'callToAdventure', label: 'Distress Signal Received', intimacy: 2, powerDiff: 0, infoAsym: 5, alignment: 6, proximity: 5, vulnerability: 3, desire: 1, stakes: 5, trust: 5, danger: 4, mystery: 7 },
      { time: 13, beat: 'refusalOfCall', label: 'Crew Debates Mission', intimacy: 3, powerDiff: 1, infoAsym: 6, alignment: 4, proximity: 6, vulnerability: 3, desire: 1, stakes: 6, trust: 4, danger: 5, mystery: 8 },
      { time: 18, beat: 'meetingMentor', label: 'Captain Makes Decision', intimacy: 3, powerDiff: 1, infoAsym: 5, alignment: 7, proximity: 6, vulnerability: 4, desire: 1, stakes: 7, trust: 6, danger: 5, mystery: 7 },
      { time: 23, beat: 'crossingThreshold', label: 'Jump to Unknown Sector', intimacy: 4, powerDiff: 0, infoAsym: 7, alignment: 7, proximity: 7, vulnerability: 5, desire: 1, stakes: 8, trust: 6, danger: 7, mystery: 9 },
      { time: 35, beat: 'testsAlliesEnemies', label: 'First Contact - Hostile', intimacy: 4, powerDiff: 2, infoAsym: 8, alignment: 3, proximity: 5, vulnerability: 6, desire: 1, stakes: 9, trust: 4, danger: 8, mystery: 8 },
      { time: 45, beat: 'testsAlliesEnemies', label: 'Uncover Conspiracy', intimacy: 5, powerDiff: 1, infoAsym: 9, alignment: 5, proximity: 6, vulnerability: 6, desire: 2, stakes: 9, trust: 5, danger: 8, mystery: 9 },
      { time: 53, beat: 'approachInmostCave', label: 'Approach Enemy Base', intimacy: 5, powerDiff: 0, infoAsym: 8, alignment: 8, proximity: 7, vulnerability: 7, desire: 2, stakes: 10, trust: 7, danger: 9, mystery: 8 },
      { time: 60, beat: 'ordeal', label: 'Major Space Battle', intimacy: 6, powerDiff: -1, infoAsym: 7, alignment: 8, proximity: 8, vulnerability: 8, desire: 2, stakes: 10, trust: 7, danger: 10, mystery: 7 },
      { time: 68, beat: 'reward', label: 'Victory - Discover Truth', intimacy: 6, powerDiff: 0, infoAsym: 5, alignment: 8, proximity: 7, vulnerability: 7, desire: 2, stakes: 8, trust: 8, danger: 6, mystery: 5 },
      { time: 75, beat: 'roadBack', label: 'Return Journey - Pursuit', intimacy: 6, powerDiff: 0, infoAsym: 4, alignment: 9, proximity: 8, vulnerability: 6, desire: 2, stakes: 8, trust: 8, danger: 7, mystery: 4 },
      { time: 85, beat: 'resurrection', label: 'Final Confrontation', intimacy: 7, powerDiff: 0, infoAsym: 3, alignment: 9, proximity: 8, vulnerability: 7, desire: 2, stakes: 9, trust: 9, danger: 8, mystery: 3 },
      { time: 100, beat: 'returnWithElixir', label: 'Return Changed', intimacy: 7, powerDiff: 0, infoAsym: 1, alignment: 9, proximity: 7, vulnerability: 5, desire: 2, stakes: 3, trust: 9, danger: 2, mystery: 1 },
    ],
    fantasy: [
      { time: 4, beat: 'ordinaryWorld', label: 'Ordinary World', intimacy: 2, powerDiff: 0, infoAsym: 2, alignment: 6, proximity: 5, vulnerability: 2, desire: 1, stakes: 2, trust: 5, danger: 1, mystery: 3 },
      { time: 10, beat: 'callToAdventure', label: 'Discover Magic/Prophecy', intimacy: 2, powerDiff: 0, infoAsym: 6, alignment: 6, proximity: 5, vulnerability: 4, desire: 1, stakes: 5, trust: 5, danger: 3, mystery: 8 },
      { time: 13, beat: 'refusalOfCall', label: 'Fear of Destiny', intimacy: 3, powerDiff: 0, infoAsym: 6, alignment: 4, proximity: 5, vulnerability: 5, desire: 1, stakes: 6, trust: 4, danger: 4, mystery: 8 },
      { time: 18, beat: 'meetingMentor', label: 'Meet Wise Guide', intimacy: 4, powerDiff: -2, infoAsym: 5, alignment: 7, proximity: 6, vulnerability: 5, desire: 1, stakes: 6, trust: 6, danger: 4, mystery: 7 },
      { time: 23, beat: 'crossingThreshold', label: 'Leave Home/Village', intimacy: 4, powerDiff: 0, infoAsym: 7, alignment: 7, proximity: 7, vulnerability: 6, desire: 2, stakes: 7, trust: 6, danger: 6, mystery: 8 },
      { time: 35, beat: 'testsAlliesEnemies', label: 'Form Fellowship', intimacy: 6, powerDiff: 0, infoAsym: 6, alignment: 8, proximity: 8, vulnerability: 6, desire: 2, stakes: 8, trust: 7, danger: 7, mystery: 7 },
      { time: 45, beat: 'testsAlliesEnemies', label: 'Battle Dark Forces', intimacy: 6, powerDiff: 0, infoAsym: 7, alignment: 8, proximity: 8, vulnerability: 7, desire: 2, stakes: 9, trust: 7, danger: 8, mystery: 6 },
      { time: 53, beat: 'approachInmostCave', label: 'Approach Dark Lord', intimacy: 7, powerDiff: 0, infoAsym: 8, alignment: 8, proximity: 9, vulnerability: 8, desire: 2, stakes: 10, trust: 8, danger: 9, mystery: 7 },
      { time: 60, beat: 'ordeal', label: 'Darkest Hour/Betrayal', intimacy: 5, powerDiff: 0, infoAsym: 9, alignment: 6, proximity: 6, vulnerability: 9, desire: 2, stakes: 10, trust: 4, danger: 10, mystery: 8 },
      { time: 68, beat: 'reward', label: 'Magical Artifact/Power', intimacy: 6, powerDiff: 1, infoAsym: 6, alignment: 8, proximity: 7, vulnerability: 7, desire: 2, stakes: 9, trust: 7, danger: 7, mystery: 5 },
      { time: 75, beat: 'roadBack', label: 'March to Final Battle', intimacy: 7, powerDiff: 0, infoAsym: 4, alignment: 9, proximity: 9, vulnerability: 6, desire: 2, stakes: 9, trust: 8, danger: 8, mystery: 4 },
      { time: 85, beat: 'resurrection', label: 'Ultimate Sacrifice/Test', intimacy: 7, powerDiff: 0, infoAsym: 3, alignment: 9, proximity: 9, vulnerability: 8, desire: 2, stakes: 10, trust: 9, danger: 9, mystery: 3 },
      { time: 100, beat: 'returnWithElixir', label: 'Peace Restored', intimacy: 8, powerDiff: 0, infoAsym: 1, alignment: 9, proximity: 8, vulnerability: 5, desire: 3, stakes: 2, trust: 9, danger: 1, mystery: 1 },
    ],
    mystery: [
      { time: 4, beat: 'ordinaryWorld', label: 'Ordinary World', intimacy: 2, powerDiff: 0, infoAsym: 1, alignment: 6, proximity: 4, vulnerability: 2, desire: 1, stakes: 2, trust: 6, danger: 1, mystery: 2 },
      { time: 10, beat: 'crime', label: 'Murder Discovered', intimacy: 2, powerDiff: 0, infoAsym: 8, alignment: 6, proximity: 5, vulnerability: 3, desire: 1, stakes: 7, trust: 5, danger: 5, mystery: 9 },
      { time: 18, beat: 'initialInvestigation', label: 'Initial Clues/Suspects', intimacy: 3, powerDiff: 1, infoAsym: 9, alignment: 6, proximity: 6, vulnerability: 3, desire: 1, stakes: 7, trust: 4, danger: 5, mystery: 9 },
      { time: 28, beat: 'firstTwist', label: 'First Twist - Red Herring', intimacy: 3, powerDiff: 0, infoAsym: 9, alignment: 5, proximity: 6, vulnerability: 4, desire: 1, stakes: 8, trust: 4, danger: 6, mystery: 10 },
      { time: 40, beat: 'deeperInvestigation', label: 'Dig Deeper - More Bodies', intimacy: 4, powerDiff: 0, infoAsym: 8, alignment: 6, proximity: 6, vulnerability: 5, desire: 1, stakes: 9, trust: 5, danger: 7, mystery: 9 },
      { time: 53, beat: 'midpointRevelation', label: 'Key Evidence Found', intimacy: 4, powerDiff: 0, infoAsym: 7, alignment: 7, proximity: 6, vulnerability: 5, desire: 1, stakes: 9, trust: 6, danger: 7, mystery: 8 },
      { time: 60, beat: 'falseResolution', label: 'Wrong Person Arrested', intimacy: 4, powerDiff: 0, infoAsym: 6, alignment: 5, proximity: 5, vulnerability: 6, desire: 1, stakes: 9, trust: 5, danger: 8, mystery: 7 },
      { time: 70, beat: 'darkestMoment', label: 'Detective Threatened', intimacy: 3, powerDiff: -1, infoAsym: 8, alignment: 4, proximity: 4, vulnerability: 8, desire: 1, stakes: 10, trust: 4, danger: 9, mystery: 8 },
      { time: 80, beat: 'finalClues', label: 'Breakthrough - Real Killer', intimacy: 4, powerDiff: 0, infoAsym: 4, alignment: 8, proximity: 5, vulnerability: 7, desire: 1, stakes: 10, trust: 7, danger: 8, mystery: 5 },
      { time: 90, beat: 'climaxReveal', label: 'Confrontation & Reveal', intimacy: 4, powerDiff: 0, infoAsym: 2, alignment: 9, proximity: 7, vulnerability: 7, desire: 1, stakes: 10, trust: 8, danger: 9, mystery: 2 },
      { time: 100, beat: 'denouement', label: 'Justice Served', intimacy: 5, powerDiff: 0, infoAsym: 1, alignment: 9, proximity: 5, vulnerability: 4, desire: 1, stakes: 2, trust: 8, danger: 2, mystery: 1 },
    ],
  };

  const calculateTension = (point) => {
    // Use modifier-adjusted weights if modifier is selected
    const activeWeights = getModifierAdjustedWeights();
    
    const misalignment = 10 - point.alignment;
    const vulnerabilityTrustGap = point.vulnerability * (10 - point.trust) / 10;
    const desireIntimacyGap = point.desire * (10 - point.intimacy) / 10;
    const proximityTrustGap = point.proximity * (10 - point.trust) / 10;
    
    const tension = (
      activeWeights.infoAsym * point.infoAsym +
      activeWeights.stakes * point.stakes +
      activeWeights.misalignment * misalignment +
      activeWeights.powerDiff * Math.abs(point.powerDiff) +
      activeWeights.vulnerabilityTrust * vulnerabilityTrustGap +
      activeWeights.desireIntimacy * desireIntimacyGap +
      activeWeights.proximityTrust * proximityTrustGap +
      activeWeights.danger * point.danger +
      activeWeights.mystery * point.mystery
    );

    const maxPossible = (
      activeWeights.infoAsym * 10 +
      activeWeights.stakes * 10 +
      activeWeights.misalignment * 10 +
      activeWeights.powerDiff * 5 +
      activeWeights.vulnerabilityTrust * 10 +
      activeWeights.desireIntimacy * 10 +
      activeWeights.proximityTrust * 10 +
      activeWeights.danger * 10 +
      activeWeights.mystery * 10
    );

    return (tension / maxPossible) * 10;
  };

  const enrichedData = useMemo(() => {
    // Map genre to arc key
    const arcMap = {
      'romance': 'romance',
      'scienceFiction': 'scienceFiction',
      'fantasy': 'fantasy',
      'mysteryThrillerSuspense': 'mystery',
    };
    
    const arcKey = arcMap[selectedGenre] || 'romance';
    const arcData = presetArcs[arcKey];
    
    return arcData.map(point => ({
      ...point,
      tension: calculateTension(point),
    }));
  }, [selectedGenre, selectedModifier, weights]);

  const toggleDimension = (dim) => {
    setVisibleDims(prev => ({ ...prev, [dim]: !prev[dim] }));
  };

  const updateWeight = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };
  
  const validateAndClampWeight = (key) => {
    const currentValue = weights[key] || 0;
    // Weights range from 0 to 3
    const min = 0;
    const max = 3;
    
    // Clamp to valid range
    const clampedValue = Math.max(min, Math.min(max, currentValue));
    
    if (clampedValue !== currentValue) {
      setWeights(prev => ({ ...prev, [key]: clampedValue }));
    }
  };

  const changeGenre = (genreKey) => {
    setSelectedGenre(genreKey);
    const newGenre = genreSystem[genreKey];
    const firstSubgenre = Object.keys(newGenre.subgenres)[0];
    setSelectedSubgenre(firstSubgenre);
    
    // First zero all weights for visual transition
    const zeroWeights = Object.keys(dimensions).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
    setWeights(zeroWeights);
    
    // Then update to new genre weights after a brief delay
    setTimeout(() => {
      const newWeights = getCompleteWeights(newGenre.subgenres[firstSubgenre].weights);
      setWeights(newWeights);
      setBaseWeights(newWeights);
    }, 100);
    
    setSelectedModifier('');
    // Update visible dimensions to genre-appropriate defaults
    setVisibleDims(getDefaultVisibleDims(genreKey));
  };

  const changeSubgenre = (subgenreKey) => {
    setSelectedSubgenre(subgenreKey);
    const newWeights = getCompleteWeights(currentGenre.subgenres[subgenreKey].weights);
    setWeights(newWeights);
    setBaseWeights(newWeights);
    setSelectedModifier('');
  };
  
  const changeModifier = (modifierKey) => {
    setSelectedModifier(modifierKey);
    // If clearing modifier, reset to base weights
    if (!modifierKey) {
      setWeights(getCompleteWeights(currentSubgenre.weights));
    }
  };

  const validateAgainstGenre = () => {
    const finalPoint = enrichedData[enrichedData.length - 1];
    const reqs = currentSubgenre.requirements;
    
    const checks = {
      intimacy: finalPoint.intimacy >= reqs.finalIntimacy[0] && finalPoint.intimacy <= reqs.finalIntimacy[1],
      trust: finalPoint.trust >= reqs.finalTrust[0] && finalPoint.trust <= reqs.finalTrust[1],
      tension: finalPoint.tension >= reqs.finalTension[0] && finalPoint.tension <= reqs.finalTension[1],
    };
    
    return checks;
  };

  const validation = validateAgainstGenre();

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-purple-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">Universal Narrative Physics Engine 🌌</h1>
        <p className="text-purple-200 text-center mb-6 italic">
          Multi-genre story analysis with structure-aware validation
        </p>

        {/* Genre/Subgenre/Modifier Selection */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold mb-2 text-purple-300">📚 Genre</h3>
              <select 
                value={selectedGenre} 
                onChange={(e) => changeGenre(e.target.value)}
                className="w-full bg-slate-800 border border-purple-500 rounded px-3 py-2"
              >
                {Object.entries(genreSystem).map(([key, genre]) => (
                  <option key={key} value={key}>{genre.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <h3 className="text-sm font-bold mb-2 text-purple-300">🎭 Subgenre</h3>
              <select 
                value={selectedSubgenre} 
                onChange={(e) => changeSubgenre(e.target.value)}
                className="w-full bg-slate-800 border border-purple-500 rounded px-3 py-2"
              >
                {Object.entries(currentGenre.subgenres).map(([key, subgenre]) => (
                  <option key={key} value={key}>{subgenre.name}</option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-sm font-bold mb-2 text-purple-300">🔍 Focus/Modifier</h3>
              <select 
                value={selectedModifier} 
                onChange={(e) => changeModifier(e.target.value)}
                className="w-full bg-slate-800 border border-purple-500 rounded px-3 py-2"
              >
                <option value="">None</option>
                {currentSubgenre.modifiers.map((modifier, idx) => (
                  <option key={idx} value={modifier}>{modifier}</option>
                ))}
              </select>
              {selectedModifier && modifierEffects[selectedModifier] && (
                <div className="mt-2 p-2 bg-purple-900/50 rounded border border-purple-500/50 text-xs">
                  <div className="font-semibold text-purple-200">
                    ⚡ {modifierEffects[selectedModifier].description}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-3 bg-purple-900/30 rounded">
              <div className="text-sm font-bold text-purple-300 mb-2">
                Plot Structure: {currentStructure.name}
              </div>
              <div className="text-xs text-purple-200">
                {currentGenre.name} stories follow the <strong>{currentStructure.name}</strong> narrative framework
              </div>
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded">
              <h4 className="text-sm font-semibold mb-2 text-purple-300">Genre Requirements:</h4>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className={validation.intimacy ? 'text-green-400' : 'text-red-400'}>
                    {validation.intimacy ? '✓' : '✗'}
                  </span>
                  <span>Final Intimacy: {currentSubgenre.requirements.finalIntimacy[0]}-{currentSubgenre.requirements.finalIntimacy[1]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={validation.trust ? 'text-green-400' : 'text-red-400'}>
                    {validation.trust ? '✓' : '✗'}
                  </span>
                  <span>Final Trust: {currentSubgenre.requirements.finalTrust[0]}-{currentSubgenre.requirements.finalTrust[1]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={validation.tension ? 'text-green-400' : 'text-red-400'}>
                    {validation.tension ? '✓' : '✗'}
                  </span>
                  <span>Final Tension: {currentSubgenre.requirements.finalTension[0]}-{currentSubgenre.requirements.finalTension[1]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Story Progression</h2>
          
          {/* Beat Structure Legend */}
          <div className="mb-4 p-4 bg-slate-800/70 rounded border border-purple-500/50">
            <h3 className="text-base font-bold mb-3 text-purple-300">
              📖 {currentStructure.name} - Story Beat Structure
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              {Object.entries(currentStructure.beats).map(([key, beat]) => (
                <div key={key} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded">
                  <div 
                    className="w-4 h-4 rounded flex-shrink-0 mt-0.5" 
                    style={{ backgroundColor: beat.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{beat.name}</div>
                    <div className="text-purple-300 text-[10px]">
                      {beat.range[0] === beat.range[1] ? `${beat.range[0]}%` : `${beat.range[0]}-${beat.range[1]}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={enrichedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis 
                dataKey="time" 
                stroke="#fff"
                label={{ value: `Story Progress (%) - ${currentStructure.name}`, position: 'bottom', offset: 40, fill: '#fff' }}
              />
              <YAxis 
                stroke="#fff"
                domain={[-5, 10]}
                label={{ value: 'Intensity', angle: -90, position: 'left', offset: 0, fill: '#fff' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #8b5cf6', borderRadius: '8px' }}
                labelStyle={{ color: '#a78bfa' }}
                itemStyle={{ color: '#fff' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-800 border border-purple-500 rounded p-3">
                        <p className="font-bold text-purple-300">{data.label}</p>
                        <p className="text-xs text-purple-200 mb-2">Beat: {currentStructure.beats[data.beat].name} ({data.time}%)</p>
                        {payload.map((entry, index) => (
                          <p key={index} style={{ color: entry.color }} className="text-sm">
                            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              <ReferenceLine y={0} stroke="#ffffff40" strokeDasharray="3 3" />
              
              {/* Plot all visible dimensions */}
              {Object.entries(dimensions).map(([key, dim]) => 
                visibleDims[key] && (
                  <Line 
                    key={key}
                    type="monotone" 
                    dataKey={key}
                    stroke={dim.color}
                    strokeWidth={2}
                    name={dim.name}
                    dot={{ r: 4 }}
                  />
                )
              )}
              
              {/* Plot tension if visible */}
              {visibleDims.tension && (
                <Line 
                  type="monotone" 
                  dataKey="tension"
                  stroke="#ff0000"
                  strokeWidth={3}
                  name="TENSION (derived)"
                  dot={{ r: 5, fill: '#ff0000' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dimension Controls */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">👁️ Visible Dimensions & Tension Weights</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const resetWeights = getCompleteWeights(currentSubgenre.weights);
                  setWeights(resetWeights);
                  setBaseWeights(resetWeights);
                }}
                className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
              >
                ↻ Reset Weights
              </button>
              <button 
                onClick={() => setVisibleDims(getDefaultVisibleDims(selectedGenre))}
                className="text-sm bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold"
              >
                ↻ Reset Visibility
              </button>
            </div>
          </div>
          
          <div className="mb-3 p-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded border border-purple-500/50">
            <p className="text-sm font-semibold text-purple-200">
              <strong className="text-purple-300">Default dimensions for {currentGenre.name}:</strong>{' '}
              {selectedGenre === 'romance' && '❤️ Intimacy, Desire, Vulnerability, Trust (relationship focus)'}
              {selectedGenre === 'scienceFiction' && '🚀 Danger, Mystery, Stakes, Trust, Alignment, Info Asymmetry (external conflict & discovery)'}
              {selectedGenre === 'fantasy' && '⚔️ Danger, Mystery, Stakes, Trust, Alignment, Vulnerability (epic quest & fellowship)'}
              {selectedGenre === 'mysteryThrillerSuspense' && '🔍 Mystery, Info Asymmetry, Danger, Stakes, Trust, Vulnerability (puzzle-solving & investigation)'}
            </p>
            <p className="text-xs text-purple-300 mt-1">
              💡 Check dimensions to display them on chart. <strong>Weight values (0-3)</strong> are multipliers that control how much each dimension contributes to tension.
              {selectedModifier && ' Yellow arrows (→) show effective weight after modifier multipliers.'}
              {' '}Amber backgrounds indicate manually adjusted values.
            </p>
            <p className="text-xs text-purple-400 mt-1 italic">
              📊 Note: Chart shows <strong>story values (0-10 scale)</strong> at each beat. Weights multiply these story values to calculate tension.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-2">
              {Object.entries(dimensions).slice(0, Math.ceil(Object.keys(dimensions).length / 2)).map(([key, dim]) => {
                const activeWeights = getModifierAdjustedWeights();
                const effectiveWeight = activeWeights[key] ? activeWeights[key].toFixed(2) : '0.00';
                const isModified = selectedModifier && modifierEffects[selectedModifier]?.adjustments[key];
                const isManuallyChanged = weights[key] !== baseWeights[key];
                
                return (
                  <div key={key} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded">
                    <label className="flex items-center gap-2 flex-1 min-w-0">
                      <input 
                        type="checkbox" 
                        checked={visibleDims[key]}
                        onChange={() => toggleDimension(key)}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <span style={{ color: dim.color }} className="font-semibold text-sm truncate">
                        {dim.name}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input 
                        type="number"
                        value={weights[key] || 0}
                        onChange={(e) => updateWeight(key, e.target.value)}
                        onBlur={() => validateAndClampWeight(key)}
                        step="0.1"
                        min="0"
                        max="3"
                        className={`w-16 border border-purple-500 rounded px-2 py-1 text-sm text-center ${
                          isManuallyChanged ? 'bg-amber-700' : 'bg-slate-700'
                        }`}
                      />
                      {isModified && (
                        <span className="text-xs text-yellow-400 w-12 text-right" title={`Modified by ${selectedModifier}`}>
                          →{effectiveWeight}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Right Column */}
            <div className="space-y-2">
              {Object.entries(dimensions).slice(Math.ceil(Object.keys(dimensions).length / 2)).map(([key, dim]) => {
                const activeWeights = getModifierAdjustedWeights();
                const effectiveWeight = activeWeights[key] ? activeWeights[key].toFixed(2) : '0.00';
                const isModified = selectedModifier && modifierEffects[selectedModifier]?.adjustments[key];
                const isManuallyChanged = weights[key] !== baseWeights[key];
                
                return (
                  <div key={key} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded">
                    <label className="flex items-center gap-2 flex-1 min-w-0">
                      <input 
                        type="checkbox" 
                        checked={visibleDims[key]}
                        onChange={() => toggleDimension(key)}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <span style={{ color: dim.color }} className="font-semibold text-sm truncate">
                        {dim.name}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input 
                        type="number"
                        value={weights[key] || 0}
                        onChange={(e) => updateWeight(key, e.target.value)}
                        onBlur={() => validateAndClampWeight(key)}
                        step="0.1"
                        min="0"
                        max="3"
                        className={`w-16 border border-purple-500 rounded px-2 py-1 text-sm text-center ${
                          isManuallyChanged ? 'bg-amber-700' : 'bg-slate-700'
                        }`}
                      />
                      {isModified && (
                        <span className="text-xs text-yellow-400 w-12 text-right" title={`Modified by ${selectedModifier}`}>
                          →{effectiveWeight}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Tension (derived) - special row below both columns */}
          <div className="flex items-center gap-3 p-2 bg-slate-900/70 rounded border border-red-500/50 mt-3">
            <label className="flex items-center gap-2 flex-1">
              <input 
                type="checkbox" 
                checked={visibleDims.tension}
                onChange={() => toggleDimension('tension')}
                className="w-4 h-4"
              />
              <span className="text-red-400 font-bold text-sm">
                ⚡ TENSION (derived from weighted dimensions)
              </span>
            </label>
            <div className="text-xs text-red-300">
              Calculated automatically
            </div>
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">📊 Genre Analysis</h3>
          <div className="p-4 bg-purple-900/30 rounded border border-purple-500">
            <p className="text-sm mb-2">
              <strong className="text-purple-300">Current Configuration:</strong>{' '}
              <strong>{currentGenre.name}</strong> → <strong>{currentSubgenre.name}</strong>
              {selectedModifier && <span> → <strong className="text-yellow-300">{selectedModifier}</strong></span>}
            </p>
            <p className="text-sm mb-2">
              <strong className="text-purple-300">Plot Structure:</strong> {currentStructure.name}
            </p>
            {selectedModifier && modifierEffects[selectedModifier] && (
              <p className="text-sm mb-2">
                <strong className="text-purple-300">Modifier Effect:</strong>{' '}
                <span className="text-yellow-200">{modifierEffects[selectedModifier].description}</span>
                <span className="text-xs text-purple-300 ml-2">
                  (Adjusting: {Object.keys(modifierEffects[selectedModifier].adjustments).map(key => 
                    key.replace(/([A-Z])/g, ' $1').toLowerCase()
                  ).join(', ')})
                </span>
              </p>
            )}
            <p className="text-sm mb-3">
              <strong className="text-purple-300">Status:</strong>{' '}
              {validation.intimacy && validation.trust && validation.tension ? 
                <span className="text-green-400 font-bold">✓ Valid trajectory for genre</span> : 
                <span className="text-yellow-400 font-bold">⚠ Check genre requirements</span>}
            </p>
            <div className="border-t border-purple-500/50 pt-3 mt-3 text-xs text-purple-200">
              <p className="mb-2"><strong>Sample Arc Display:</strong> Each genre displays a representative story trajectory using its canonical plot structure. Notice how Romance uses Romancing the Beat beats, while Science Fiction and Fantasy follow the Hero's Journey, and Mystery uses Mystery/Suspense structure. The dimensional emphasis (high intimacy vs. high danger/mystery) shifts based on genre conventions{selectedModifier ? ', and modifiers further refine tension calculations' : ''}.</p>
              <div className="mt-2 p-2 bg-slate-800/50 rounded border border-purple-400/30">
                <p className="font-semibold text-purple-300 mb-1">🧮 How Tension is Calculated:</p>
                <p className="text-[11px]">
                  <strong>Story values</strong> (0-10 scale, shown in chart) × <strong>Weights</strong> (0-3 multipliers, set in controls) = contribution to tension
                  <br/>
                  Example: If Stakes = 10.0 (story value) and weight = 1.5, contribution = 15.0 to tension score
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalNarrativeAnalyzer;