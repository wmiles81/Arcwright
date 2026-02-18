/**
 * OpenAI-format tool definitions for native tool calling via OpenRouter.
 * Each entry maps 1:1 to an ACTION_HANDLERS key in actionExecutor.js.
 */
export const toolDefinitions = [
  // --- Scaffold ---
  {
    type: 'function',
    function: {
      name: 'updateBeat',
      description: 'Update dimension values or properties on an existing scaffold beat.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Beat ID (e.g., beat_1234)' },
          updates: {
            type: 'object',
            description: 'Key-value pairs to update. Keys can be dimension names (intimacy, trust, tension, stakes, pacing, agency, identity, sensory, worldComplexity, moralAmbiguity, goalAlignment), time (0-100), label, or beat.',
            additionalProperties: true,
          },
        },
        required: ['id', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addBeat',
      description: 'Add a new scaffold beat with dimension values.',
      parameters: {
        type: 'object',
        properties: {
          beat: {
            type: 'object',
            description: 'Beat object with id, time (0-100), beat (structure beat key), label, and dimension values.',
            properties: {
              id: { type: 'string', description: 'Unique ID (e.g., beat_<timestamp>)' },
              time: { type: 'number', description: 'Position in story (0-100%)' },
              beat: { type: 'string', description: 'Structure beat key' },
              label: { type: 'string', description: 'Display name' },
              intimacy: { type: 'number' },
              trust: { type: 'number' },
              tension: { type: 'number' },
              stakes: { type: 'number' },
              pacing: { type: 'number' },
              agency: { type: 'number' },
              identity: { type: 'number' },
              sensory: { type: 'number' },
              worldComplexity: { type: 'number' },
              moralAmbiguity: { type: 'number' },
              goalAlignment: { type: 'number' },
            },
            required: ['id', 'time', 'beat', 'label'],
          },
        },
        required: ['beat'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeBeat',
      description: 'Remove a scaffold beat by ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Beat ID to remove' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearScaffold',
      description: 'Remove all scaffold beats.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // --- Genre config ---
  {
    type: 'function',
    function: {
      name: 'setGenre',
      description: 'Change the primary genre.',
      parameters: {
        type: 'object',
        properties: {
          genre: { type: 'string', description: 'Genre key (e.g., romance, scienceFiction, fantasy, mystery)' },
        },
        required: ['genre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setSubgenre',
      description: 'Change the subgenre within the current genre.',
      parameters: {
        type: 'object',
        properties: {
          subgenre: { type: 'string', description: 'Subgenre key' },
        },
        required: ['subgenre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setModifier',
      description: 'Set or clear the genre modifier.',
      parameters: {
        type: 'object',
        properties: {
          modifier: { type: 'string', description: 'Modifier name, or empty string to clear' },
        },
        required: ['modifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setPacing',
      description: 'Set or clear the pacing option.',
      parameters: {
        type: 'object',
        properties: {
          pacing: { type: 'string', description: 'Pacing name, or empty string to clear' },
        },
        required: ['pacing'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateWeight',
      description: 'Adjust a tension weight channel.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Weight key (e.g., conflict, mystery, romantic, etc.)' },
          value: { type: 'number', description: 'Weight value (0-3)' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resetWeights',
      description: 'Reset all tension weights to genre defaults.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // --- Blending ---
  {
    type: 'function',
    function: {
      name: 'setBlendEnabled',
      description: 'Toggle genre blending on or off.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true to enable blending, false to disable' },
        },
        required: ['enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setSecondaryGenre',
      description: 'Set the secondary genre for blending.',
      parameters: {
        type: 'object',
        properties: {
          genre: { type: 'string', description: 'Genre key for secondary blend' },
        },
        required: ['genre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setSecondarySubgenre',
      description: 'Set the secondary subgenre for blending.',
      parameters: {
        type: 'object',
        properties: {
          subgenre: { type: 'string', description: 'Subgenre key for secondary blend' },
        },
        required: ['subgenre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setBlendRatio',
      description: 'Set the blend percentage between primary and secondary genres.',
      parameters: {
        type: 'object',
        properties: {
          ratio: { type: 'number', description: 'Blend ratio (1-99), percentage of primary genre' },
        },
        required: ['ratio'],
      },
    },
  },

  // --- Analysis ---
  {
    type: 'function',
    function: {
      name: 'updateChapterScores',
      description: 'Update dimension scores for a chapter.',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: 'Chapter ID' },
          scores: {
            type: 'object',
            description: 'Dimension key-value pairs to update.',
            additionalProperties: true,
          },
        },
        required: ['chapterId', 'scores'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeChapter',
      description: 'Remove a chapter by ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Chapter ID to remove' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setProjectionPercent',
      description: 'Set the projection percentage for analysis view.',
      parameters: {
        type: 'object',
        properties: {
          percent: { type: 'number', description: 'Projection percentage (0-100)' },
        },
        required: ['percent'],
      },
    },
  },

  // --- Visibility ---
  {
    type: 'function',
    function: {
      name: 'toggleDimension',
      description: 'Toggle visibility of a dimension on the chart.',
      parameters: {
        type: 'object',
        properties: {
          dim: { type: 'string', description: 'Dimension key to toggle' },
        },
        required: ['dim'],
      },
    },
  },

  // --- Edit workflow ---
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: 'Create or overwrite a file in the editor\'s open directory and open it in the editor. Use this to write revised chapter content. The file is saved to disk and opened in the secondary (right) pane if dual-pane mode is on.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path within the open directory (e.g., "Export-abc123/01-Chapter-One-v02.md"). Subdirectories are created automatically.' },
          content: { type: 'string', description: 'Full file content to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },

  // --- AI Project file access ---
  {
    type: 'function',
    function: {
      name: 'readProjectFile',
      description: 'Read the contents of a file. Can read from the AI project file catalog, the editor\'s open directory, or book project files. Use the file path exactly as shown in the Project File Catalog or editor contents. Do NOT prefix paths with "Arcwrite/".',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path — use exactly as shown in the system prompt catalog or editor contents (e.g., "style-guide.md" or "projects/ai/notes/outline.md"). Do NOT add "Arcwrite/" prefix.',
          },
        },
        required: ['path'],
      },
    },
  },
];
