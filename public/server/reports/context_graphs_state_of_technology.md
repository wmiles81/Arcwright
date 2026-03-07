# Context Graphs: A Survey of Representations, Formalisms, and Applications Across Knowledge Representation, Narrative Modeling, and Interactive Systems

**Date:** February 12, 2026
**Authors:** W. Miles PhD, with research assistance from Claude (Anthropic)
**Status:** Working Paper

---

## Abstract

The term "context graph" has emerged independently across multiple research traditions — knowledge representation, decision support, enterprise data governance, computational narratology, interactive digital entertainment, and graph-based machine learning — without a unified definition or shared formalism. This survey maps the landscape of context graph representations and related formalisms, with particular attention to their applicability to narrative modeling: the computational representation of character states, character-to-character influence, and story-world dynamics. We examine formal graph structures ranging from Resource Description Framework (RDF) Named Graphs and knowledge graph quadruples to character interaction networks and quality-based narrative systems. We identify a significant gap in the literature: while rich formalisms exist for static knowledge representation and for analytical extraction of character networks from existing texts, no established framework addresses the generative use case of coupled character state machines — systems where one character's state transition produces contextually mediated inputs to other characters, enabling the computational derivation of narrative trajectories from forces, constraints, and relational context. We survey the closest precedents across interactive drama, narrative planning, dynamical systems modeling, and simulationist storytelling, and characterize the open problem space.

---

## 1. Introduction

Graphs are among the most natural representations for structured knowledge. A graph's nodes can represent entities, states, or concepts; its edges can represent relationships, transitions, or dependencies. When the relationships between entities are themselves conditioned on circumstances — temporal, spatial, causal, or situational — the graph must encode not merely *what* is related but *under what conditions* the relationship holds. This is the essential insight behind context graphs: context is not metadata appended to a graph; it is a structural element of the graph itself.

The need for context-aware graph representations has been recognized across several independent research communities. In knowledge representation, the limitations of bare subject-predicate-object triples led to Named Graphs (Carroll et al., 2005), reification, and ultimately the quadruple-based Context Graph formalism (Xu et al., 2024). In decision support, Brézillon developed Contextual Graphs as directed acyclic graph (DAG) structures where branching occurs at context-sensitive decision points (Brézillon, 2003). In computational narratology, researchers have modeled stories as hierarchical graphs spanning story-world, story, and discourse layers (Akimoto, 2017), while character interaction networks have been extracted and analyzed across literary corpora (Labatut & Bost, 2019). In interactive digital entertainment, drama managers (Bates, 1992; Mateas & Stern, 2003), quality-based narrative systems (Kennedy, 2010), and simulationist storytelling engines (Evans & Short, 2014) have all grappled with the problem of context-dependent state transitions in narrative systems.

Despite this convergence, no unified formalism bridges these traditions. This survey aims to map the landscape comprehensively, identify shared structures and divergent assumptions, and characterize the open problems; particularly those relevant to the generative modeling of narrative through coupled, context-dependent character state systems.

### 1.1 Scope and Organization

This paper is organized as follows. Section 2 covers foundational graph formalisms in knowledge representation, from Sowa's Conceptual Graphs through RDF and contemporary Context Graphs. Section 3 examines context-sensitive decision representations. Section 4 surveys computational narratology and character modeling. Section 5 covers interactive narrative systems and drama management. Section 6 reviews graph-based machine learning approaches relevant to context modeling. Section 7 discusses industry applications. Section 8 identifies gaps and open problems, particularly in the generative narrative modeling domain. Section 9 concludes.

---

## 2. Knowledge Representation Foundations

### 2.1 Conceptual Graphs (Sowa, 1976, 1984, 2000)

The formal study of graph-based knowledge representation has deep roots. Sowa introduced Conceptual Graphs as a system for representing meaning in natural language, drawing on Peirce's existential graphs and the semantic network tradition in artificial intelligence (Sowa, 1976). The full formalism was developed in *Conceptual Structures: Information Processing in Mind and Machine* (Sowa, 1984).

A Conceptual Graph is a bipartite graph consisting of two types of nodes: **concept nodes** (representing entities, attributes, or states) and **relation nodes** (representing relationships between concepts). Edges connect relation nodes to concept nodes, forming a structured representation amenable to logical inference. Sowa defined six canonical formation rules — detachment, copy, join, iteration, restriction, and simplification — providing a complete and sound inference system grounded in first-order logic.

The mature formulation in *Knowledge Representation: Logical, Philosophical, and Computational Foundations* (Sowa, 2000) refined the relationship between Conceptual Graphs and formal logic, establishing them as a diagrammatic calculus with well-defined semantics. Conceptual Graphs remain influential as a foundation for graph-based reasoning, though they do not natively represent temporal or contextual metadata on relationships.

### 2.2 RDF Triples and Their Limitations

The Resource Description Framework (RDF), standardized by the World Wide Web Consortium (W3C), represents knowledge as triples of the form (subject, predicate, object) (W3C, 2004; Cyganiak et al., 2014). RDF provides a minimal, extensible foundation for the Semantic Web, but its triple structure imposes a fundamental limitation: contextual information about relationships — when they held, where, according to whom, with what confidence — cannot be directly expressed. The triple (Obama, presidentOf, UnitedStates) carries no temporal scope; it is equally true in 2009 and 2026 under the bare triple model.

Several extensions have been developed to address this limitation.

### 2.3 Named Graphs and Quads

Carroll et al. (2005) proposed Named Graphs as a mechanism for grouping RDF triples into named collections, extending the triple to a **quadruple** (subject, predicate, object, graph-name). The graph name provides a hook for attaching provenance, trust, and temporal metadata at the graph level rather than the statement level. Named Graphs were formalized in the W3C RDF 1.1 specification (Cyganiak et al., 2014), which defines an RDF Dataset as comprising exactly one default graph and zero or more named graphs, where each named graph is a pair of an IRI (Internationalized Resource Identifier) or blank node and an RDF graph.

### 2.4 YAGO2 and the SPOTLX Model

Hoffart et al. (2011, 2013) developed YAGO2, a knowledge base containing over 447 million facts about 9.8 million entities, with explicit temporal and spatial dimensions. YAGO2 introduced the **SPOTL** quintuple model (Subject, Property, Object, Time, Location) and the extended **SPOTLX** sextuple (adding conteXt for provenance). Rather than encoding temporal and spatial information through reification — which required, in their analysis, "convoluted joins" for simple queries — SPOTL treats time and location as first-class structural elements of each fact. Human evaluation confirmed 95% accuracy across the knowledge base.

### 2.5 RDF-star and Triple Terms

The RDF-star initiative (Hartig et al., 2021), currently being integrated into the RDF 1.2 specification, takes a different approach: rather than extending the tuple size, it allows triples themselves to appear as subjects or objects of other triples. This recursive structure enables statements about statements — for example, asserting that a particular claim was made by a particular source at a particular time — without the verbosity of classical reification (which requires four triples to describe one statement). In RDF 1.2, the terminology shifts from "quoted triples" to "triple terms," and a "reifying triple" is defined as one where the predicate is `rdf:reifies` and the object is a triple term (W3C RDF-star Working Group, 2022).

### 2.6 Context Graphs (Xu et al., 2024)

Xu et al. (2024) proposed the most explicit formalization of context as a structural graph element. Their Context Graph (CG) is defined as a 5-tuple:

> **CG = {E, R, Q, E_C, R_C}**

Where **E** is the entity set, **R** the relation set, **Q** a set of quadruples (h, r, t, r_c) extending each fact with a relation context r_c, **E_C** the set of entity contexts (attributes, descriptions, aliases, images, reference links), and **R_C** the set of relation contexts (temporal validity, geographic location, provenance, confidence levels, quantitative data).

The key distinction from prior work is that both entity contexts and relation contexts are first-class structural components, not metadata layers. The paper demonstrates this through a CGR3 (Context Graph Reasoning: Retrieve-Rank-Reason) pipeline that leverages large language models (LLMs) to perform context-aware knowledge graph completion and question answering, reporting a 33% improvement in Hits@1 on the FB15k-237 benchmark. Follow-up work has appeared at the Conference of the North American Chapter of the Association for Computational Linguistics (NAACL) 2025 (Li et al., 2025) and the Association for the Advancement of Artificial Intelligence (AAAI) conference 2025 (Li et al., 2025b).

### 2.7 Provenance-Aware Knowledge Representation

Sikos and Philp (2020) provide a comprehensive treatment of provenance-aware knowledge representation, surveying approaches to tracking the origin, derivation, and trustworthiness of knowledge graph assertions. Their work contextualizes Named Graphs, reification, and n-ary relations within a unified framework, identifying provenance as a dimension of context that interacts with temporal, spatial, and epistemic dimensions. This perspective — that context is multidimensional and that different dimensions may be relevant in different application domains — is particularly relevant to narrative modeling, where the "context" of a character relationship includes temporal position in the arc, the characters' psychological states, prior events, and genre conventions.

---

## 3. Context-Sensitive Decision Representations

### 3.1 Contextual Graphs (Brézillon, 2002, 2003, 2007)

Brézillon developed Contextual Graphs (CxGs) as a formalism for representing how practitioners make context-sensitive decisions (Brézillon, 2002, 2003). A Contextual Graph is a DAG where paths represent different **practices** — ways of reaching a decision under specific contextual conditions. Branching occurs at **contextual nodes**: points where the active context (the set of contextual elements currently relevant to the decision) determines which sub-path is taken.

The formalism distinguishes between:
- **External knowledge** (information available but not currently relevant)
- **Contextual knowledge** (information relevant to the current decision context)
- **Proceduralized context** (knowledge actively invoked in the decision process)

This three-level model of context activation — available, relevant, active — has direct parallels in narrative modeling, where a character's wound (psychological backstory) is always present (external knowledge), becomes relevant when triggered by specific narrative conditions (contextual knowledge), and actively shapes behavior when the character is in a triggered state (proceduralized context).

Brézillon applied Contextual Graphs to domains including medicine, military decision support, and transportation (Brézillon, 2007). The formalism was explicitly designed for situations where "the same task may be achieved differently depending on the context," a property shared by narrative state transitions where the same event (e.g., a betrayal) produces different character responses depending on the character's current state, history, and psychological profile.

---

## 4. Computational Narratology and Character Modeling

### 4.1 Emotional Arcs and Story Shapes

The computational study of narrative structure received significant empirical grounding from Reagan et al. (2016), who applied sentiment analysis to 1,327 stories from Project Gutenberg using the hedonometer lexicon. Three independent decomposition methods — singular value decomposition, supervised classification, and hierarchical clustering — converged on six fundamental emotional arc shapes: Rags to Riches (steady rise), Riches to Rags/Tragedy (steady fall), Man in a Hole (fall then rise), Icarus (rise then fall), Cinderella (rise-fall-rise), and Oedipus (fall-rise-fall). This work validated Kurt Vonnegut's informal hypothesis about story shapes and established that emotional trajectories could be extracted computationally from prose text.

Jockers (2015) independently developed the syuzhet R package for extracting sentiment-derived plot arcs from fiction, applying Fourier transformation to decompose sentiment trajectories into fundamental shapes across a corpus of approximately 50,000 novels. While the methodological details generated scholarly debate (Swafford, 2015), the underlying insight — that narrative structure can be represented as a trajectory through an emotional state space — has proven durable.

These trajectory-based representations treat stories as time series: continuous curves plotting one or more sentiment dimensions against narrative time. They are analytically powerful but generatively limited — they describe what arcs look like without modeling the mechanisms that produce them.

### 4.2 Character Interaction Networks

Labatut and Bost (2019) provide the definitive survey of fictional character network extraction and analysis, covering the full pipeline: character detection and identification (via named entity recognition and coreference resolution), interaction extraction (via co-occurrence, dialogue attribution, or action-based methods), network construction, and network analysis using graph-theoretic metrics (centrality, community detection, role inference). Their survey covers networks extracted from novels, plays, films, television series, and comics, and distinguishes between static networks (aggregating all interactions across a work) and dynamic networks (tracking network evolution across chapters or scenes).

Character interaction networks have been constructed for numerous literary works, with notable analyses of the *Game of Thrones* series tracking the evolution of character centrality across books (demonstrating, for example, Eddard Stark's declining betweenness centrality correlating with his narrative marginalization) and *Harry Potter* interaction networks revealing the social structures of the wizarding world.

These networks represent relationships between characters as edges, with edge weights typically derived from co-occurrence frequency or sentiment polarity. However, they are **analytical** — extracted from existing texts — rather than **generative**. They describe the structure of character relationships that an author has already created, but do not model the mechanisms by which those relationships evolve.

### 4.3 Computational Modeling of Evolving Character Relationships

Several research groups have addressed the computational modeling of how character relationships change over narrative time. Chaturvedi et al. (2016) formulated relationship modeling as a structured prediction problem, proposing a Markovian model that accumulates historical beliefs about relationship and status changes. Their follow-up work (Chaturvedi et al., 2017) developed an unsupervised approach using latent states learned from data, enabling inference of relationship types beyond simple sentiment polarity.

Iyyer et al. (2016) — in work that received the Best Long Paper Award at NAACL-HLT (Human Language Technologies) 2016 — developed an unsupervised neural network with dictionary learning for modeling how relationships between two characters change over time, generating interpretable and accurate relationship trajectories.

Bamman et al. (2014) took a different approach, inferring latent character types across 15,099 English novels from 1700 to 1899 using a Bayesian mixed-effects model. This work discovered recurring character personas and how they cluster across literary periods, providing empirical evidence that character types are a real structural feature of fiction, not merely a critical convenience.

The MARCUS (Modelling Arcs for Understanding Stories) pipeline (Bhyravajjula et al., 2022) represents a more recent event-centric approach, generating character arcs from narrative texts through a pipeline of event extraction, participant identification, implied emotion detection, and sentiment analysis. Applied to *Harry Potter* and *Lord of the Rings*, MARCUS produces graphical plots showing relationship trajectories between character pairs.

### 4.4 Hierarchical Narrative Structure

Akimoto (2017) proposed a hierarchical graph model for narrative structure spanning three dimensions: **story world** (the background world of entities, relationships, and settings), **story** (chronologically organized events), and **discourse** (the structure used for expression and presentation). Each dimension is represented as a hierarchical graph, and the model is designed to serve as a common basis for both generative and analytical computational narrative systems. This multidimensional framing — where the same narrative is simultaneously a world-state graph, an event sequence, and a discourse structure — offers a useful architectural pattern for systems that must bridge between content modeling and prose generation. Related work appears in Ogata and Akimoto (2016).

Mani and Pustejovsky (2004) contributed a tree-structured temporal representation for narratives where nodes represent abstract events interpreted as pairs of time points, building on the TimeML temporal annotation framework. Mani's subsequent monograph (Mani, 2013) represents the first systematic integration of narratology, artificial intelligence, and computational linguistics, proposing the NarrativeML annotation scheme and covering character goals, causality, and temporal reasoning.

### 4.5 Propp's Morphology and Computational Formalizations

Vladimir Propp's *Morphology of the Folktale* (1928/1968), based on analysis of 100 Russian fairy tales, identified 31 narrative functions (narratemes) occurring in fixed sequential order and seven character roles (dramatis personae). Propp's morphology has been repeatedly formalized computationally: as directed graphs where nodes are functions and edges are sequence constraints, as Bayesian networks for probabilistic plot generation, and as formal grammars.

Gervás (2013) treated Propp's morphology explicitly as a generative grammar, using unification to incrementally build discourse conceptualizations from story actions modeled through preconditions and postconditions. This approach preserves Propp's original framework as a plot-driving sequence of character functions rather than generalizing it beyond folk tales.

Propp's functions are relevant to the context graph discussion because they represent an early formalization of **typed narrative events** (functions) that produce **state transitions** (changes in the story world) conditioned on **character roles** (the dramatis personae who perform them). The function "Villainy" (function VIII) has different narrative consequences depending on whether the villain acts against the hero, the hero's family, or the community — an instance of context-dependent state transition.

### 4.6 Dynamical Systems Approaches to Narrative

Pianzola (2024) bridges dynamical systems theory with literary narratology and computational modeling, exploring how narrative can be modeled as a complex dynamical system. This perspective treats stories as trajectories through multidimensional state spaces, where the evolution of the trajectory is governed by coupling dynamics between dimensions. While primarily theoretical, this work provides a formal framework for understanding narrative as state evolution rather than event sequence — a perspective directly relevant to context-dependent character state modeling.

Brahman and Chaturvedi (2020) developed EmoSup and EmoRL models for emotion-aware neural story generation, using reinforcement learning to generate stories that adhere to desired emotion arcs. This represents one of the first attempts to use emotional trajectory as a generative constraint rather than an analytical extraction.

Elsner (2012) proposed character-based kernels for measuring novelistic plot structure, using word-list-based methods to compute character emotion profiles and employing kernel methods to measure similarity between novels. This work demonstrates that character emotional states can serve as a basis for structural comparison across texts.

---

## 5. Interactive Narrative Systems

### 5.1 Drama Managers and the Oz Project

The concept of a **drama manager** — an artificial intelligence (AI) system that monitors narrative state and intervenes to maintain dramatic quality — originated in the Oz Project at Carnegie Mellon University. Bates (1992) introduced the foundational vision of believable agents in interactive worlds, arguing that characters needed emotional models to support dramatic engagement. Kelso, Weyhrauch, and Bates (1993) developed the concept of "dramatic presence" — the feeling of being inside a dramatic story — and the architectural requirements for systems that support it, including a drama manager that operates above the level of individual character AI.

Nelson et al. (2006) formalized the drama manager concept in a survey for the Institute of Electrical and Electronics Engineers (IEEE) Computer Graphics and Applications, defining it as a module that "uses a model of drama to make decisions about how to adjust the experience in real-time." Riedl and Bulitko (2013) provide a comprehensive survey of interactive narrative technologies in AI Magazine, covering drama management, narrative planning, and player modeling approaches.

### 5.2 Façade

Mateas and Stern (2003, 2005) created *Façade*, the landmark interactive drama in which players interact with a married couple (Trip and Grace) whose relationship is deteriorating. The system architecture comprises three layers:

1. **A Behavior Language (ABL)** — a reactive planning language for character AI, inspired by Hap (Loyall & Bates, 1991). ABL manages character behaviors as parallel behavior trees with joint goals and sequential/parallel subgoals.

2. **Drama Manager** — sequences narrative "beats" (small dramatic units, each 1-3 minutes) to form a coherent dramatic arc. The drama manager selects beats based on dramatic tension values, narrative preconditions, and player behavior, maintaining a global dramatic arc while responding to local player actions.

3. **Natural Language Processing (NLP)** — interprets player text input and maps it to discourse acts that influence character reactions and drama manager decisions.

*Façade* is significant to the context graph discussion because its beat sequencing system is an early example of **context-dependent narrative state transitions**: the drama manager's selection of the next beat depends on the current dramatic tension, the history of beats already played, and the player's recent actions — a form of contextual graph traversal, though not formalized as such.

### 5.3 Versu

Evans and Short (2014) developed Versu, a simulationist storytelling system in which every character is driven by autonomous AI rather than pre-scripted dialogue trees. Published in IEEE Transactions on Computational Intelligence and AI in Games, their approach models characters with:

- **Personality traits** that influence behavioral preferences
- **Social practices** — culturally situated behavioral scripts (e.g., "making introductions," "flirting," "arguing") that coordinate interaction between autonomous agents
- **Autonomous decision-making** — each character selects actions based on their goals, personality, and perception of the social situation

Versu represents the closest industry precedent to coupled character state machines. Each character's behavior is the product of its internal state (personality, goals, emotional state) interacting with the social context (other characters' states, active social practices, environmental conditions). Character actions modify the shared social context, which in turn influences other characters' subsequent decisions. This is implicit coupling through shared state rather than explicit coupling through typed force propagation, but the structural pattern is similar.

### 5.4 Narrative Planning

Riedl and Young (2010) developed the foundational approach to narrative planning in their Journal of Artificial Intelligence Research (JAIR) paper, introducing the Intent-driven Partial Order Causal Link (IPOCL) planner. IPOCL distinguishes between author intentions (the desired dramatic structure) and character goals (what characters want), planning narratives that satisfy both simultaneously. This dual-satisfaction requirement — the plot must be causally coherent AND characters must act believably — formalizes a tension that context-dependent character state systems must also resolve.

Ware and Young (2014), in work that received the Best Student Paper Award at the AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment (AIIDE) 2014, developed Glaive, a state-space narrative planner that reasons about character cooperation and conflict via causal structures and possible worlds. Glaive can solve non-trivial narrative planning problems in under one second, demonstrating that computational narrative generation with character intentionality is tractable.

Szilas (2003, 2007) developed IDtension, a narrative engine for interactive drama that draws on Greimas's and Todorov's narrative grammars and Bremond's roles and processes. The system uses rule-based generation of meaningful narrative actions combined with a user model for action ranking and selection.

### 5.5 Quality-Based Narrative and Storylets

Failbetter Games introduced Quality-Based Narrative (QBN) with *Echo Bazaar* (later *Fallen London*), launched in 2009 and described in a 2010 blog post (Kennedy, 2010). In QBN, narrative content is organized as **storylets** — small narrative segments with associated prerequisites (numerical quality thresholds that gate access) and effects (modifications to quality values upon completion). Rather than a branching tree, the narrative possibility space is defined by the intersection of accumulated quality values and the pool of available storylets.

Kennedy later refined this concept, moving from "quality-based narrative" toward "resource narrative" (Kennedy, 2017), emphasizing that the strategic manipulation of scarce, reproducible, fungible resources is the distinguishing feature of the design pattern. Kennedy's Game Developers Conference (GDC) 2016 talk formalized three pillars of interactive narrative: choice, consequence, and complicity.

Kreminski and Wardrip-Fruin (2018) provided the first academic formalization of the storylet design space, identifying four key dimensions: precondition specification, repeatability, content type, and content selection architecture. Garbe et al. (2019) developed StoryAssembler, a system for generating dynamic narratives from storylet-like fragments with author-specified constraints on narrative coherence.

Short (2016) contributed a taxonomy of narrative structures "beyond branching," distinguishing quality-based narrative (storylets unlocked by accumulated qualities), salience-based narrative (content selected by applicability to current world state), and waypoint narrative (non-player characters, or NPCs, pathfinding toward conversational trigger points). Short's work on Narrative States (Short, 2019) applied ternary plots (simplex diagrams) to visualize narrative possibility spaces defined by three quality variables, demonstrating that geometric visualization of state spaces can reveal design problems including under-developed narrative regions and abrupt state transitions.

### 5.6 Procedural Narrative Generation Using Graphs

Kybartas and Bidarra (2017) provide a comprehensive survey of procedural narrative generation approaches in IEEE Transactions on Computational Intelligence and AI in Games, covering planning-based, simulation-based, and emergent approaches. Their taxonomy distinguishes between systems that plan narratives top-down (drama managers, plot planners) and systems that generate narratives bottom-up from character simulation (agent-based approaches like Versu).

Riedl and Young (2005) developed techniques for generating branching story graphs — directed graph structures where nodes represent story states and edges represent narrative actions, with branching occurring at points where player choice or stochastic events create divergent narrative paths.

---

## 6. Graph-Based Machine Learning

### 6.1 Temporal Knowledge Graphs

Trivedi et al. (2017) introduced Know-Evolve, a deep learning framework for temporal reasoning on dynamic knowledge graphs, presented at the International Conference on Machine Learning (ICML) 2017. Know-Evolve models the temporal evolution of entity relationships using a temporal point process, enabling prediction of future events and relationship states based on historical patterns. This temporal graph learning paradigm — where the graph structure itself evolves over time and models must capture both structural and temporal patterns — has direct relevance to narrative modeling, where character relationships evolve as the story progresses.

Cai et al. (2023) provide a comprehensive survey of temporal knowledge graph completion, covering embedding-based, rule-based, and neural approaches to predicting future facts in temporally evolving knowledge graphs. The survey identifies key challenges including temporal sparsity, long-range temporal dependencies, and the interaction between structural and temporal patterns.

### 6.2 Context-Aware Graph Neural Networks

Li et al. (2025c) developed ContextGNN, a context-aware graph neural network (GNN) for recommendation, accepted at the International Conference on Learning Representations (ICLR) 2025. ContextGNN fuses pairwise and two-tower representations in a single-stage architecture, modeling context-user and context-item interactions where context includes temporal, spatial, and situational factors. The architecture demonstrates that context can be integrated directly into graph neural network message passing rather than treated as external features, reporting approximately 20% improvement over prior methods.

More broadly, the graph neural network literature has established that message passing on graphs — where nodes update their representations by aggregating information from neighbors — provides a natural computational framework for context propagation. In narrative terms, this suggests an architecture where character state updates are computed by aggregating contextual signals from connected characters, world-state nodes, and event nodes.

---

## 7. Industry Applications

### 7.1 Enterprise Context Graphs

In the enterprise data governance domain, companies including Atlan have developed context graph platforms that treat operational metadata — data lineage, governance policies, ownership, quality metrics — as first-class graph nodes connected to data assets through typed relationships (Atlan, 2024). While this commercial application is distant from narrative modeling, it demonstrates the viability of context graphs as production systems that integrate heterogeneous contextual information for decision support.

### 7.2 AI Agent Memory

The Zep framework (Ramasubramanian et al., 2025), also known as Graphiti, implements a temporal knowledge graph for AI agent memory. Graphiti uses a bi-temporal data model tracking both event time and ingestion time, supporting incremental updates without full graph recomputation. The system enables AI agents to maintain evolving contextual memory across interactions — a capability directly relevant to narrative generation systems that must track character states, relationship histories, and world-state evolution across extended story arcs.

### 7.3 Novel Generation Systems

The SAGA project (GitHub: Lanerra/saga) implements a novel generation system using multiple AI agents coordinated through a Neo4j knowledge graph that tracks characters, plots, and world elements. While limited documentation is available, the architecture demonstrates the use of graph-based state tracking for maintaining coherence across AI-generated narrative content.

StoryVerse (Wang et al., 2024) implements LLM-based (large language model) character simulation with narrative planning through "abstract acts" that translate authorial intent into character action sequences. The system demonstrates a separation between narrative planning (what should happen) and character simulation (how characters respond), mediated by shared world state — a pattern relevant to context-dependent character state systems.

### 7.4 Creative Writing Tools

NovelWorld implements a knowledge-graph-powered fiction writing platform with character relationships and plot dependencies. Twine (Salter & Moulthrop, 2021) provides a visual graph-based authoring environment for interactive fiction where the graph IS the primary creative interface. ink (inkle, 2016) provides a narrative scripting language for games with branching and state tracking.

---

## 8. Gaps and Open Problems

### 8.1 The Analytical-Generative Gap

The most significant gap in the literature is between **analytical** and **generative** systems. Character interaction networks (Labatut & Bost, 2019), emotional arc extraction (Reagan et al., 2016; Jockers, 2015), and relationship trajectory modeling (Iyyer et al., 2016; Chaturvedi et al., 2016, 2017) are all analytical: they extract structure from existing texts. Narrative planners (Riedl & Young, 2010; Ware & Young, 2014) and drama managers (Mateas & Stern, 2003, 2005) are generative, but they operate at the plot level (what events occur) rather than the character-state level (how characters are internally affected by events).

No established framework addresses the problem of **generative character state modeling**: given a sequence of narrative events (typed forces), a set of characters (with psychological profiles and current states), and a set of genre-specific conventions (coupling rules), compute the resulting character state trajectories. The dynamics are straightforward to describe informally — a betrayal reduces trust, triggers defensive behaviors, and may activate psychological wounds — but formalizing them as a computational system with well-defined inputs, state transitions, and outputs remains an open problem.

### 8.2 The Coupling Problem

In multi-character narratives, characters do not evolve independently. Character A's state transition (e.g., revealing vulnerability) produces an input to Character B, whose response (acceptance or rejection) produces an input back to Character A. This **coupling** — where one character's state transition is another character's contextual input — is fundamental to narrative dynamics but has no established computational formalism.

The closest precedents are:
- **Versu's social practices** (Evans & Short, 2014), where characters coordinate through shared social context, but coupling is implicit rather than formally specified
- **Drama managers** (Mateas & Stern, 2003, 2005), which sequence events but do not model character-to-character influence at the state level
- **Narrative planners** (Riedl & Young, 2010), which reason about character goals and cooperation but represent relationships as plan constraints rather than evolving state variables
- **Dynamical systems approaches** (Pianzola, 2024), which provide the theoretical framework of coupled dimensions but have not been implemented as computational narrative generation systems

### 8.3 Context as a First-Class Element in Narrative State Transitions

Xu et al.'s (2024) insight — that context must be a structural element of the graph, not appended metadata — applies directly to narrative state transitions. The effect of a betrayal on a character depends on:

- **The character's current state** (trusting vs. already suspicious)
- **The character's psychological profile** (wound, defense mechanisms)
- **The relationship history** (first betrayal vs. repeated pattern)
- **The genre conventions** (the same betrayal has different narrative weight in romance vs. thriller)
- **The temporal position** (early-story betrayal vs. dark-night-of-the-soul betrayal)

All of these are context. A bare triple (CharacterA, betrays, CharacterB) is as informationally impoverished as (Obama, presidentOf, USA) without temporal scope. The narrative equivalent of Xu et al.'s quadruple would be a state transition annotated with the full context that determines its effect:

> (CharacterA, betrays, CharacterB, {A_state, B_state, relationship_history, genre, arc_position})

This contextual annotation determines the *consequences* of the transition — which dimensions change, by how much, and in which direction.

### 8.4 Universal Forces and Genre-Specific Mappings

A promising direction — not yet formalized in the literature — is the separation of **universal narrative forces** (event types that recur across genres) from **genre-specific dimensional mappings** (how those forces affect genre-specific state variables). Forces such as revelation, betrayal, choice-under-cost, protection, loss, and exposure appear across romance, mystery, fantasy, science fiction, and other genres. What changes is not the force type but the dimensional consequences: a betrayal in a romance affects trust and vulnerability; in a mystery, it affects solution confidence and justice arc; in a fantasy, it might affect alliance stability and corruption index.

Similarly, **universal narrative constraints** — principles like "trust cannot increase without being earned" (no free trust), "agency gains require sacrifice" (agency requires cost), "power distributions cannot remain static" (power must shift), and "knowledge acquisition must have consequences" (knowledge has consequences) — may apply across genres as physics-like laws governing state transitions, with genre-specific instantiations determining which dimensions are affected.

### 8.5 The State Vocabulary Problem

Continuous-valued dimensions (trust on a [-1, 1] scale) are computationally convenient but narratively opaque. Authors and readers think in terms of recognizable character conditions — "guarded but curious," "falling but afraid," "broken and retreating" — not numerical coordinates. A framework that bridges between named character states (discrete, semantically meaningful) and dimensional representations (continuous, computationally tractable) would serve both authorial intuition and computational precision. Named states could be defined as regions in dimensional space (with ranges rather than points), with forces driving transitions between states and dimensions tracking position within and between state regions.

This resembles the quality-based narrative approach (Kennedy, 2010; Short, 2019) applied not to player-facing interactive fiction but to author-facing narrative design: states as named regions in a possibility space, with force-driven transitions between them, visualized through the geometric tools Short demonstrated with ternary plots.

---

## 9. Conclusion

The term "context graph" names a convergent intuition across multiple research traditions: that relationships, states, and transitions cannot be meaningfully represented without the circumstances that condition them. Knowledge representation has addressed this through quadruples, named graphs, and recursive triple structures. Decision support has addressed it through contextual branching in DAGs. Interactive narrative has addressed it through drama managers, quality-based systems, and simulationist character AI. Computational narratology has addressed it through character interaction networks, emotional arc extraction, and hierarchical narrative models.

What remains unaddressed is the synthesis: a generative context graph formalism for narrative that unifies typed forces (universal event categories), genre-specific dimensional mappings (how forces affect state variables), universal constraints (physics-like laws governing transitions), coupled character state machines (where transitions propagate through character relationships), and named state vocabularies (semantically meaningful character conditions). The components exist across the surveyed traditions; the integration does not.

The open problem is not merely academic. Practical narrative generation systems — from AI-assisted novel writing to game narrative engines — increasingly need to model character dynamics that are contextually grounded, relationally coupled, and genre-aware. The context graph, as a unifying formalism for these requirements, represents a significant opportunity for both computational narratology and applied narrative AI.

---

## Bibliography

Akimoto, T. (2017). Computational modeling of narrative structure: A hierarchical graph model for multidimensional narrative structure. *International Journal of Computational Linguistics Research*, 8(3), 92–108.

Atlan. (2024). What is a context graph? Atlan Knowledge Base. https://atlan.com/know/what-is-a-context-graph/

Bamman, D., Underwood, T., & Smith, N. A. (2014). A Bayesian mixed effects model of literary character. *Proceedings of the 52nd Annual Meeting of the Association for Computational Linguistics (ACL 2014)*, 1, 370–379. https://aclanthology.org/P14-1035/

Bates, J. (1992). The nature of characters in interactive worlds and the Oz project. *Presence: Teleoperators and Virtual Environments*, 1(1), 133–134. https://doi.org/10.1162/pres.1992.1.1.133

Bhyravajjula, S., Narayan, U., & Shrivastava, M. (2022). MARCUS: An event-centric NLP pipeline that generates character arcs from narratives. *Proceedings of the Fifth Workshop on Narrative Extraction From Texts (Text2Story 2022)*, CEUR Workshop Proceedings, 3117, 67–74. https://ceur-ws.org/Vol-3117/paper7.pdf

Brahman, F., & Chaturvedi, S. (2020). Modeling protagonist emotions for emotion-aware storytelling. *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, 5587–5601. https://aclanthology.org/2020.emnlp-main.426/

Brézillon, P. (2002). Modeling and using context for decision support. *European Journal of Operational Research*, 136(3), 587–606.

Brézillon, P. (2003). Representation of procedures and practices in contextual graphs. *The Knowledge Engineering Review*, 18(2), 147–174.

Brézillon, P. (2007). Context modeling: Task model and practice model. *Modeling and Using Context: Proceedings of CONTEXT 2007*, Lecture Notes in Computer Science, 4635, 122–135. Springer.

Cai, B., Xiang, Y., Gao, L., Zhang, H., Li, Y., & Li, J. (2023). Temporal knowledge graph completion: A survey. *Proceedings of the Thirty-Second International Joint Conference on Artificial Intelligence (IJCAI 2023)*, Survey Track.

Carroll, J. J., Bizer, C., Hayes, P., & Stickler, P. (2005). Named graphs, provenance and trust. *Proceedings of the 14th International Conference on World Wide Web (WWW 2005)*, 613–622. https://doi.org/10.1145/1060745.1060835

Chaturvedi, S., Iyyer, M., & Daumé III, H. (2017). Unsupervised learning of evolving relationships between literary characters. *Proceedings of the 31st AAAI Conference on Artificial Intelligence (AAAI 2017)*, 31(1). https://ojs.aaai.org/index.php/AAAI/article/view/10982

Chaturvedi, S., Srivastava, S., Daumé III, H., & Dyer, C. (2016). Modeling evolving relationships between characters in literary novels. *Proceedings of the 30th AAAI Conference on Artificial Intelligence (AAAI 2016)*, 30(1). https://ojs.aaai.org/index.php/AAAI/article/view/10358

Cyganiak, R., Wood, D., & Lanthaler, M. (Eds.). (2014). RDF 1.1 concepts and abstract syntax. W3C Recommendation, 25 February 2014. https://www.w3.org/TR/rdf11-concepts/

Elsner, M. (2012). Character-based kernels for novelistic plot structure. *Proceedings of the 13th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2012)*, 634–644. https://aclanthology.org/E12-1065/

Evans, R., & Short, E. (2014). Versu—A simulationist storytelling system. *IEEE Transactions on Computational Intelligence and AI in Games*, 6(2), 113–130.

Garbe, J., Kreminski, M., Samuel, B., Wardrip-Fruin, N., & Mateas, M. (2019). StoryAssembler: An engine for generating dynamic choice-driven narratives. *Proceedings of the 14th International Conference on the Foundations of Digital Games (FDG 2019)*, Article 24. https://doi.org/10.1145/3337722.3337732

Gervás, P. (2013). Propp's morphology of the folk tale as a grammar for generation. *Proceedings of the 2013 Workshop on Computational Models of Narrative (CMN 2013)*, OASIcs, 32, 106–122. https://doi.org/10.4230/OASIcs.CMN.2013.106

Hartig, O., Kellogg, G., & Champin, P.-A. (2021). RDF-star and SPARQL-star: A syntax to express statements about statements in RDF. In *Proceedings of the 16th International Conference on Semantic Systems (SEMANTiCS 2020)* (pp. 72–88). IOS Press.

Hoffart, J., Suchanek, F. M., Berberich, K., Lewis-Kelham, E., de Melo, G., & Weikum, G. (2011). YAGO2: Exploring and querying world knowledge in time, space, context, and many languages. *Proceedings of the 20th International Conference on World Wide Web (WWW 2011)*, Demo Track.

Hoffart, J., Suchanek, F. M., Berberich, K., & Weikum, G. (2013). YAGO2: A spatially and temporally enhanced knowledge base from Wikipedia. *Artificial Intelligence*, 194, 28–61. https://doi.org/10.1016/j.artint.2012.06.001

Iyyer, M., Guha, A., Chaturvedi, S., Boyd-Graber, J., & Daumé III, H. (2016). Feuding families and former friends: Unsupervised learning for dynamic fictional relationships. *Proceedings of the 2016 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL-HLT 2016)*, 1534–1544. https://aclanthology.org/N16-1180/

Jockers, M. L. (2015, February 2). *Revealing sentiment and plot arcs with the syuzhet package* [Blog post]. https://www.matthewjockers.net/2015/02/02/syuzhet/

Kelso, M. T., Weyhrauch, P., & Bates, J. (1993). Dramatic presence. *Presence: Teleoperators and Virtual Environments*, 2(1), 1–15.

Kennedy, A. (2010). *Quality-based narrative* [Blog post]. Failbetter Games. https://www.failbettergames.com/news/echo-bazaar-narrative-structures-part-two

Kennedy, A. (2017, June 13). *I've stopped talking about quality-based narrative* [Blog post]. Weather Factory. https://weatherfactory.biz/qbn-to-resource-narratives/

Kreminski, M., & Wardrip-Fruin, N. (2018). Sketching a map of the storylets design space. *Interactive Storytelling: Proceedings of the 11th International Conference on Interactive Digital Storytelling (ICIDS 2018)*, Lecture Notes in Computer Science, 11318, 160–164. https://doi.org/10.1007/978-3-030-04028-4_14

Kybartas, B., & Bidarra, R. (2017). A survey on story generation techniques for authoring computational narratives. *IEEE Transactions on Computational Intelligence and AI in Games*, 9(3), 239–253. https://doi.org/10.1109/TCIAIG.2016.2546063

Labatut, V., & Bost, X. (2019). Extraction and analysis of fictional character networks: A survey. *ACM Computing Surveys*, 52(5), Article 89, 1–40. https://doi.org/10.1145/3344548

Loyall, A. B., & Bates, J. (1991). *Hap: A reactive, adaptive architecture for agents*. Unpublished manuscript, Carnegie Mellon University, Pittsburgh, PA.

Li, M., Yang, C., Xu, C., Jiang, X., Qi, Y., Leung, H., & King, I. (2025a). Retrieval, reasoning, re-ranking: A context-enriched framework for knowledge graph completion. *Proceedings of the 2025 Conference of the North American Chapter of the Association for Computational Linguistics (NAACL 2025)*. https://aclanthology.org/2025.naacl-long.221/

Li, M., Yang, C., Xu, C., Song, Z., Jiang, X., Guo, J., Leung, H., & King, I. (2025b). Context-aware inductive knowledge graph completion with latent type constraints and subgraph reasoning. *Proceedings of the 39th AAAI Conference on Artificial Intelligence (AAAI 2025)*. https://doi.org/10.1609/aaai.v39i11.33318

Li, Y., Leskovec, J., & Fey, M. (2025c). ContextGNN: Beyond two-tower recommendation systems. *Proceedings of the 13th International Conference on Learning Representations (ICLR 2025)*.

Mani, I. (2013). *Computational modeling of narrative*. Synthesis Lectures on Human Language Technologies, 18. Morgan & Claypool. https://doi.org/10.2200/S00459ED1V01Y201212HLT018

Mani, I., & Pustejovsky, J. (2004). Temporal discourse models for narrative structure. *Proceedings of the Workshop on Discourse Annotation (at ACL 2004)*, 57–64. https://aclanthology.org/W04-0208/

Mateas, M., & Stern, A. (2003). Façade: An experiment in building a fully-realized interactive drama. *Proceedings of the Game Developers Conference (GDC 2003)*, Game Design Track.

Mateas, M., & Stern, A. (2005). Structuring content in the Façade interactive drama architecture. *Proceedings of the First AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment (AIIDE 2005)*, 93–98. https://ojs.aaai.org/index.php/AIIDE/article/view/18722

Nelson, M. J., Roberts, D. L., Isbell, C. L., & Mateas, M. (2006). Reinforcement learning for declarative optimization-based drama management. *IEEE Computer Graphics and Applications*, 26(3), 56–63.

Ogata, T., & Akimoto, T. (Eds.). (2016). *Computational and cognitive approaches to narratology*. IGI Global. ISBN: 978-1-5225-0432-0.

Pianzola, F. (2024). Dynamical systems, literary theory, and the computational modelling of narrative. *Interdisciplinary Science Reviews*. https://doi.org/10.1177/03080188241257167

Propp, V. (1968). *Morphology of the folktale* (L. Scott, Trans.; 2nd ed., revised and edited by L. A. Wagner, with introduction by A. Dundes). University of Texas Press. (Original work published 1928)

Ramasubramanian, P., Cross, D., Blank, P., Sahar, A., & Grafstein, D. (2025). *Zep: A temporal knowledge graph architecture for agent memory*. arXiv preprint arXiv:2501.13956. https://arxiv.org/abs/2501.13956

Reagan, A. J., Mitchell, L., Kiley, D., Danforth, C. M., & Dodds, P. S. (2016). The emotional arcs of stories are dominated by six basic shapes. *EPJ Data Science*, 5, Article 31. https://doi.org/10.1140/epjds/s13688-016-0093-1

Riedl, M. O., & Bulitko, V. (2013). Interactive narrative: An intelligent systems approach. *AI Magazine*, 34(1), 67–77. https://ojs.aaai.org/aimagazine/index.php/aimagazine/article/view/2449

Riedl, M. O., & Young, R. M. (2005). An objective character believability evaluation procedure for multi-agent story generation systems. *Proceedings of the 5th International Working Conference on Intelligent Virtual Agents (IVA 2005)*, Lecture Notes in Computer Science, 3661, 278–291.

Riedl, M. O., & Young, R. M. (2010). Narrative planning: Balancing plot and character. *Journal of Artificial Intelligence Research*, 39, 217–268.

Salter, A., & Moulthrop, S. (2021). *Twining: Critical and creative approaches to hypertext narratives*. Amherst College Press.

Short, E. (2016, April 12). Beyond branching: Quality-based, salience-based, and waypoint narrative structures. *Emily Short's Interactive Storytelling* (blog). https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/

Short, E. (2019, November 23). Narrative states. *Emily Short's Interactive Storytelling* (blog). https://emshort.blog/2019/11/23/narrative-states/

Sikos, L. F., & Philp, D. (2020). Provenance-aware knowledge representation: A survey of data models and contextualized knowledge graphs. *Data Science and Engineering*, 5, 293–316.

Sowa, J. F. (1976). Conceptual graphs for a data base interface. *IBM Journal of Research and Development*, 20(4), 336–357.

Sowa, J. F. (1984). *Conceptual structures: Information processing in mind and machine*. Addison-Wesley.

Sowa, J. F. (2000). *Knowledge representation: Logical, philosophical, and computational foundations*. Brooks/Cole.

Szilas, N. (2003). IDtension: A narrative engine for interactive drama. *Proceedings of the Technologies for Interactive Digital Storytelling and Entertainment Conference (TIDSE 2003)*.

Szilas, N. (2007). A computational model of an intelligent narrator for interactive narratives. *Applied Artificial Intelligence*, 21(8), 753–801.

Trivedi, R., Dai, H., Wang, Y., & Song, L. (2017). Know-Evolve: Deep temporal reasoning for dynamic knowledge graphs. *Proceedings of the 34th International Conference on Machine Learning (ICML 2017)*, 70, 3462–3471.

W3C. (2004). RDF primer. W3C Recommendation, 10 February 2004. https://www.w3.org/TR/rdf-primer/

W3C RDF-star Working Group. (2022). *RDF-star and SPARQL-star community group report*. World Wide Web Consortium. https://www.w3.org/community/rdf-star/

Wang, Y., et al. (2024). StoryVerse: Towards co-authoring dynamic plot with LLM-based character simulation via narrative planning. *Proceedings of the ACM International Conference on the Foundations of Digital Games (FDG 2024)*. https://doi.org/10.1145/3649921.3656987

Ware, S. G., & Young, R. M. (2014). Glaive: A state-space narrative planner supporting intentionality and conflict. *Proceedings of the 10th AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment (AIIDE 2014)*, 10(1), 80–86. https://ojs.aaai.org/index.php/AIIDE/article/view/12712

Xu, C., Li, M., Yang, C., Jiang, X., Tang, L., Qi, Y., & Guo, J. (2024). Context Graph. *arXiv preprint*, arXiv:2406.11160. https://arxiv.org/abs/2406.11160
