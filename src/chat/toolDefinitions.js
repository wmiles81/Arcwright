/**
 * OpenAI-format tool definitions for native tool calling via OpenRouter.
 * Each entry maps 1:1 to an ACTION_HANDLERS key in actionExecutor.js.
 */
export const toolDefinitions = [
  // --- Read-only state getters ---
  {
    type: 'function',
    function: {
      name: 'getGenreConfig',
      description: 'Get the current genre configuration: genre, subgenre, modifier, pacing, blend settings, and genre-specific requirements (end-of-story dimension targets).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableGenres',
      description: 'List all available genres and their subgenres. Use this when the user wants to change genres or explore genre options.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getWeights',
      description: 'Get the current tension weight values (9 channels, range 0-3). These control how much each tension dimension contributes to the narrative arc.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDimensions',
      description: 'Get the 11 narrative dimension definitions with their names and value ranges.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlotStructure',
      description: 'Get the current plot structure and its beat definitions with position ranges.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getScaffoldBeats',
      description: 'Get all scaffold beats with their dimension values, time positions, beat types, and labels. Returns an empty array if no beats exist yet.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getChapters',
      description: 'Get all chapters with their scores, status, word counts, and dimension values. Returns an empty array if no chapters exist.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRevisionChecklist',
      description: 'Get the revision checklist with item recommendations and checked state. Returns an empty array if no revision items exist.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEditorContents',
      description: 'Get the contents of open editor panes (primary and secondary tabs), including file names, word counts, and full text content.',
      parameters: { type: 'object', properties: {} },
    },
  },

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

  // --- Sequence writing ---
  {
    type: 'function',
    function: {
      name: 'runSequence',
      description: 'Write N chapters or documents sequentially, each as a fresh focused LLM call with minimal context. Use this for ANY request to write 2 or more chapters/documents — do NOT try to write them all in one response. Each step\'s task must be fully self-contained: include character names, POV, beat context, word target, and relevant story details. Each file is written to disk and opened in the editor automatically.',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            description: 'Array of sequential writing tasks.',
            items: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'Full self-contained task description for this step. Include: chapter title, POV character, beat/arc position, key events, word count target, and any character or story context needed.',
                },
                outputFile: {
                  type: 'string',
                  description: 'Relative file path to save this step\'s output (e.g., "chapters/01-chapter-one.md"). Subdirectories are created automatically.',
                },
              },
              required: ['task', 'outputFile'],
            },
          },
        },
        required: ['steps'],
      },
    },
  },

  // --- AI Project file access ---
  {
    type: 'function',
    function: {
      name: 'readProjectFile',
      description: 'Read the contents of a file. Can read from skill folders (using relative paths like "schemas/file.json" or "references/workflows/stage_1.md"), the AI project file catalog, the editor\'s open directory, or book project files. Use relative paths exactly as shown in the Skill Files tree or Project File Catalog.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path — use relative paths as shown in the system prompt (e.g., "schemas/assistant-persona.template.json" for skill folder files, or filenames for editor files). Do NOT add "Arcwrite/" prefix.',
          },
        },
        required: ['path'],
      },
    },
  },

  // --- Artifacts ---
  {
    type: 'function',
    function: {
      name: 'writeArtifact',
      description: 'Write a book production artifact to the artifacts/ folder in the active book project. Use this for story dossiers, character sheets, outlines, trope analyses, premise docs, hook worksheets, world-building docs, and any output over ~500 words. The file is saved, indexed in the manifest, and opened in the editor. Returns a short summary — the full content lives in the file, not in chat.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Filename for the artifact (e.g., "story-dossier-v1.md", "character-profiles.md"). Flat filenames only — no subdirectories.',
          },
          content: {
            type: 'string',
            description: 'Full file content to write.',
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata for the artifact manifest entry.',
            properties: {
              type: {
                type: 'string',
                description: 'Artifact type (e.g., "story_dossier", "outline", "character_profile", "world_building", "premise", "trope_analysis", "hook", "notes").',
              },
              description: {
                type: 'string',
                description: 'Brief description of what this artifact contains.',
              },
              source: {
                type: 'string',
                description: 'What generated this artifact (e.g., agent name, skill name, or "chat").',
              },
            },
          },
        },
        required: ['filename', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listArtifacts',
      description: 'List all artifacts in the book project\'s artifacts/ folder. Returns the manifest showing file names, types, descriptions, and creation dates. Use this to see what artifacts already exist before creating new ones or to find relevant reference material.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // --- Image generation ---
  {
    type: 'function',
    function: {
      name: 'generateImage',
      description: 'Generate an image using the configured image generation provider and model (set in Settings > Image). The image is saved as a PNG to the artifacts/ folder and displayed in chat. Use this when the user asks for visual content: character portraits, scene illustrations, book covers, mood boards, maps, concept art, etc.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to generate. Be specific about composition, style, lighting, colors, mood, and subject matter.',
          },
          filename: {
            type: 'string',
            description: 'Filename for the saved image (e.g., "character-portrait.png"). Must end in .png.',
          },
          size: {
            type: 'string',
            description: 'Image dimensions. Common values: "1024x1024", "1792x1024", "1024x1792". Defaults to the configured default size.',
          },
        },
        required: ['prompt', 'filename'],
      },
    },
  },

  // --- Orchestrator / Multi-agent ---
  {
    type: 'function',
    function: {
      name: 'listAgents',
      description: 'List all available AI Projects that can be spawned as agents. Returns their IDs, names, descriptions, and available file catalogs.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listPromptTools',
      description: 'List all available custom prompts that can be used as tools. Returns their IDs, names, descriptions, and template variables.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawnAgent',
      description: 'Spawn an AI Project as an agent to perform a task. The agent runs with its own system prompt and file access, executes the task, and returns the result. Use this for delegating specialized work to purpose-built agents.',
      parameters: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'The AI Project ID to spawn as an agent (from listAgents).',
          },
          task: {
            type: 'string',
            description: 'The task description for the agent to perform.',
          },
          inputs: {
            type: 'object',
            description: 'Optional key-value inputs to pass to the agent (e.g., content to analyze, parameters).',
            additionalProperties: true,
          },
          provider: {
            type: 'string',
            description: 'Optional provider to use (openrouter, openai, anthropic). Defaults to current provider.',
          },
          model: {
            type: 'string',
            description: 'Optional model ID override. Defaults to current model.',
          },
        },
        required: ['agentId', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listSequences',
      description: 'List all saved named sequences. Returns their IDs, names, descriptions, and step counts. Use this before calling runNamedSequence.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'runNamedSequence',
      description: 'Run a saved named sequence by ID. Each step executes its configured template (or referenced Prompt Tool), optionally chains output to the next step, and writes to disk if an outputFile is set. Use listSequences first to find available sequences.',
      parameters: {
        type: 'object',
        properties: {
          sequenceId: {
            type: 'string',
            description: 'Sequence ID from listSequences.',
          },
          userInputs: {
            type: 'object',
            description: 'Optional map of {{variable}} values to fill into step templates.',
            additionalProperties: true,
          },
        },
        required: ['sequenceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'runPrompt',
      description: 'Execute a custom prompt as a tool. The prompt template is filled with provided inputs and executed. Use this for well-defined transformations like rewriting, summarizing, extracting, or formatting.',
      parameters: {
        type: 'object',
        properties: {
          promptId: {
            type: 'string',
            description: 'The custom prompt ID to execute (from listPromptTools).',
          },
          inputs: {
            type: 'object',
            description: 'Key-value inputs for template variables (e.g., selected_text, user_input).',
            additionalProperties: true,
          },
          provider: {
            type: 'string',
            description: 'Optional provider override. Defaults to prompt\'s configured provider or current.',
          },
          model: {
            type: 'string',
            description: 'Optional model override. Defaults to prompt\'s configured model or current.',
          },
        },
        required: ['promptId'],
      },
    },
  },
];
