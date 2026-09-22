# Lossless Rewrite

> Design specification, including proposed features. For the implemented capabilities, setup instructions and current limits, start with the [README](../README.md).

### Rewrite freely. Keep what matters.

**Working product category:** AI-native editing environment
**Core idea:** AI editing where the user controls the information and constraints, while the AI explores the writing.

---

# 1. Executive Summary

Current AI editors treat rewriting primarily as generation: the user gives an instruction, the model produces new text, and the user manually checks whether the result still says what they intended.

This breaks down for substantial edits.

When users ask an LLM to shorten, restructure, simplify, make more technical, improve flow, merge sections, synthesize results, or rewrite from scratch, they are implicitly giving the model control over two different things:

1. **what information remains**, and
2. **how that information is expressed**.

Users often want to change the second aggressively without giving up control of the first.

Lossless Rewrite separates these layers.

Users can indicate:

* wording that should remain exactly as written;
* ideas that must survive but may be rephrased;
* source material that must be represented somewhere in the output;
* relationships between claims and supporting material that must remain valid;
* information that is expendable;
* and the direction in which they want the writing to evolve.

A generative LLM performs the rewriting.

A fast verifier such as Jev continuously evaluates the proposed result against the user's semantic constraints, coverage requirements, grounding relationships, and editing preferences.

The system can reject problematic edits, ask the user when uncertain, or automatically regenerate them.

The result is not merely a safer rewrite.

It is an editor where the user can independently manipulate:

**content, expression, coverage, structure, and writing direction.**

---

# 2. Core Product Thesis

The product is based on one fundamental separation:

> **The information I want to communicate is not the same thing as the words currently used to communicate it.**

Current AI editing largely conflates them.

Lossless Rewrite lets the user preserve the first while radically changing the second.

A user should be able to say, implicitly or explicitly:

> I care about this idea, not this sentence.

or:

> I love this sentence. Leave it alone.

or:

> You can rewrite all of this, but every major finding from these four sections must still appear somewhere.

or:

> I don't know how I want this written yet. This version is wrong; show me another direction.

The system should support all of these within the same editing model.

---

# 3. The Problem

## 3.1 Editing changes information unintentionally

A requested stylistic transformation can accidentally alter:

* factual claims;
* numbers;
* dates;
* qualifications;
* uncertainty;
* causal strength;
* requirements;
* commitments;
* citations;
* relationships between ideas;
* scope;
* emphasis.

The more substantial the requested rewrite, the harder manual verification becomes.

---

## 3.2 Compression is especially difficult

Users frequently want:

> Make this much shorter without losing the important information.

The problem is that the model decides what is "important."

Its importance function may not match the user's.

A polished 200-word result may silently omit one of the findings the user specifically cared about.

The user then has to reread both source and output and mentally perform a coverage audit.

Lossless Rewrite should make this explicit.

---

## 3.3 Users care about meaning without caring about wording

A common editing state is:

> I like what this says, but I hate how it says it.

Ordinary text locking is therefore insufficient.

The system needs to distinguish:

**preserve these characters**

from:

**preserve this proposition.**

---

## 3.4 Important information may live elsewhere

When writing a Discussion from a Results section, a summary from a report, a proposal from notes, or a specification from multiple sources, users need to know:

> Did the rewrite actually incorporate all the relevant material?

This is a **coverage** problem, not merely a rewriting problem.

---

## 3.5 New text must remain grounded in its source

Coverage is only one direction.

The reverse problem is:

> Did the rewrite introduce claims that are no longer supported by the source?

Therefore the product needs both:

**Source → Output:** Was required information retained?

**Output → Source:** Can substantive output claims be traced back to source material?

---

## 3.6 Users often cannot describe their desired style upfront

Editing is frequently recognition-driven rather than specification-driven.

Users often know:

> No.

> Better.

> Too dry.

> More like the previous version.

> I like this paragraph's style more than that one.

They do not necessarily possess a complete prompt describing the desired endpoint.

Current AI systems repeatedly force the user to translate vague judgments into increasingly elaborate instructions.

Lossless Rewrite should instead treat editing as **interactive search through a space of possible expression**.

---

# 4. Product Promise

Lossless Rewrite should let a user:

> **Rewrite aggressively while retaining deliberate control over what survives.**

The system should support transformations such as:

* rewriting;
* shortening;
* expanding;
* restructuring;
* merging;
* splitting;
* simplifying;
* making more technical;
* making less dry;
* increasing argument density;
* changing tone;
* synthesizing multiple sections;
* converting source material into another document section;
* and exploring alternative writing directions.

The protection mechanisms should remain independent of the requested transformation.

---

# 5. Core Interaction Vocabulary

The interaction model should stay extremely small.

The system may internally maintain many constraints, but the user should not need a cockpit full of controls.

## 5.1 Keep Wording

**Meaning:** Preserve this exact text.

Use when the user already likes a sentence, phrase, equation, quotation, title, or formulation.

Example:

> The most fluent version was not necessarily the one that kept the most findings.

The surrounding paragraph may be completely rewritten, but this sentence stays untouched.

---

## 5.2 Keep Meaning

**Meaning:** Preserve the information or proposition, but allow the wording to change freely.

Example source:

> Participants repeatedly moved between prompting the model, editing its draft, and checking the source.

Possible rewrite:

> Participants iteratively alternated between prompting, revising the draft, and verifying against the source.

The surface form changed substantially.

The underlying information survived.

This is one of the most important primitives in the product.

---

## 5.3 Must Cover

**Meaning:** This source material must be represented somewhere in the resulting text.

The requirement does not imply:

* preserving its original sentence;
* preserving its original paragraph;
* preserving its original order;
* or even preserving it locally.

Example:

A user selects Results §5.1–5.4 and asks:

> Turn these into one concise Discussion paragraph.

The system checks that the essential information from all required areas is represented.

---

## 5.4 Free to Cut

**Meaning:** This content does not need to survive if removing it improves the requested transformation.

This can remain an advanced or implicit interaction in the MVP.

Its purpose is to help the system understand what is deliberately expendable rather than merely unprotected.

---

## 5.5 Ground / Link

The user may indicate that a statement derives from, depends on, or should remain consistent with another piece of text.

Some of these relationships should also be inferred automatically.

Examples:

Results finding → Discussion claim

Evidence → conclusion

Requirement → implementation description

Method → reported limitation

Source section → summary sentence

The system should detect when editing creates an orphaned claim or breaks a previously valid relationship.

---

# 6. Semantic Coverage

Coverage is one of the central differentiators of the product.

A source section should be decomposed into meaningful information units.

For example:

### Results §5.1

F1. The AI rewrites reached the requested length in most cases.

F2. Shortened versions were rated as more readable than the originals.

### Results §5.2

F3. Readability did not predict how many findings survived.

F4. Numbers and hedges were the details most often lost.

### Results §5.3

F5. Readers noticed only a minority of the missing findings.

The system may automatically extract candidate units and let the user review them.

The output can then display:

> 5 / 5 required ideas represented.

If one disappears:

> 4 / 5 represented.

> Missing: readers noticed only a minority of the missing findings.

The user should not have to manually reread the entire source to discover this.

---

# 7. Grounding

Coverage checks whether source material survived.

Grounding checks whether generated material is supported.

For every substantive claim in the generated text, the system should attempt to associate supporting source material.

Conceptually:

SOURCE → OUTPUT = coverage

OUTPUT → SOURCE = grounding

A good rewrite satisfies both.

The UI could expose relationships only when useful:

> This claim is supported by Results §5.3.

or:

> Warning: this statement does not appear to have clear support in the selected source material.

Grounding should not imply perfect factual verification of the outside world.

It means consistency with the provided source context.

---

# 8. Cross-Document and Cross-Section Relationships

The system should not think exclusively in before/after pairs.

A document should gradually become a lightweight semantic dependency graph.

Example:

Results F3
↓
Discussion C2
↓
Design implication I1

If F3 is removed or materially altered, the system should re-check C2 and I1.

Similarly:

RQ3
↓
Results §5.1 + §5.2

If editing the Results causes one aspect of the question to disappear, the system can flag incomplete coverage.

This enables a more general capability:

> **Editing one part of a document while understanding consequences elsewhere.**

That should remain a long-term architectural principle even if the first MVP supports only simple relationships.

---

# 9. Direction Finding

Lossless Rewrite should not require users to know the perfect editing prompt.

A user should be able to react.

Example:

AI produces Version A.

User:

> Not this.

The system offers deliberately separated directions:

**More technical**

**More direct**

**More explanatory**

The user chooses one.

The model generates Version B.

User:

> Closer, but less dry.

The system updates its representation of the desired direction.

The user is searching the writing space interactively.

---

# 10. Contrastive Steering

Direction finding should rely primarily on comparisons rather than large parameter panels.

The user may express:

> More like this.

> Less like that.

> Keep the density of version 2 but the tone of version 1.

> I prefer this paragraph's style.

The system infers dimensions that differentiate the references.

Potential inferred dimensions include:

* density;
* technicality;
* directness;
* explanatory detail;
* formality;
* argument strength;
* sentence complexity;
* hedging;
* narrative flow;
* verbosity;
* specificity.

These dimensions are internal representations, not necessarily permanent sliders in the UI.

---

# 11. Editing Trajectory

The system should treat user reactions as data.

Example history:

V1 — rejected

V2 — "too verbose"

V3 — accepted direction

V4 — "too assertive"

V5 — accepted

The system derives a temporary editing profile such as:

* information density

* technical specificity

− generic framing

− repetition

preserve cautious scientific language

This profile should primarily be scoped to the active editing task or document unless explicitly saved.

The system should not require the user to repeatedly teach the same preference within one editing session.

---

# 12. Generative Architecture

Lossless Rewrite should separate generation from verification.

## Generative LLM

Responsible for:

* writing;
* rewriting;
* restructuring;
* condensation;
* expansion;
* candidate generation;
* repair after rejected changes.

It should be allowed to be creative.

## Jev / Fast Semantic Evaluator

Responsible for repeated narrow judgments such as:

* Did protected meaning survive?
* Is finding F4 represented?
* Did certainty increase?
* Is this claim supported by source S3?
* Is this candidate closer to the accepted direction?
* Did the output retain information from every required subsection?
* Was a protected relationship broken?
* Did a forbidden factual change occur?

Jev should not be the writer.

Its value is as a cheap, parallel evaluation layer.

---

# 13. Verification Architecture

The basic loop is:

USER REQUEST
↓
GENERATIVE MODEL
↓
PROPOSED EDIT / CANDIDATE
↓
DETERMINISTIC CHECKS
↓
SEMANTIC CHECKS
↓
POLICY ENGINE
↓
PASS / REVIEW / FAIL

### PASS

Apply the edit.

### REVIEW

The system is uncertain enough that the user should decide.

### FAIL

Reject or repair the edit.

---

# 14. Automatic Repair

A rejected edit should not necessarily become a warning.

Whenever possible, it should become another generation constraint.

Example:

Attempt 1:

> was associated with
> → caused

Verification:

**FAIL — causal strength increased.**

The system sends the reason back to the generative model.

Attempt 2:

> was associated with
> → was linked to

Verification:

**PASS.**

The user only sees the successful output unless they inspect the repair history.

For the demo, showing one automatic repair is useful because it makes the architecture visible.

---

# 15. Deterministic Checks

Do not waste probabilistic inference on things software can verify reliably.

Examples include:

* literal protected text;
* changed numbers;
* dates;
* percentages;
* URLs;
* citation identifiers;
* section references;
* equations;
* named entities when strict preservation is requested;
* missing required blocks;
* word count / compression ratio.

Semantic evaluation should complement deterministic checks rather than replace them.

---

# 16. Semantic Checks

Semantic evaluation is required for cases such as:

Original:

> The intervention may improve performance.

Rewrite:

> The intervention improves performance.

No important literal token necessarily gives a complete account of the change.

The semantic checker should recognize that epistemic strength increased.

Other examples include:

* correlation → causation;
* some → all;
* may → will;
* preliminary → established;
* one subgroup → entire population;
* conditional requirement → unconditional requirement;
* qualification removed;
* distinction between two concepts collapsed.

---

# 17. Information Representation

Internally, the system should represent several object types.

## Source Unit

A piece of original material.

Fields may include:

* ID;
* text span;
* source location;
* section;
* type;
* provenance.

## Semantic Unit

An extracted proposition or information unit.

Fields may include:

* ID;
* short representation;
* source unit references;
* importance;
* user status.

## Constraint

Examples:

KEEP_WORDING

KEEP_MEANING

MUST_COVER

FREE_TO_CUT

GROUND_TO

RELATIONSHIP

## Output Claim

A proposition found in the generated output.

Fields:

* text span;
* associated source units;
* grounding confidence;
* affected constraints.

## Direction Signal

Examples:

* accepted version;
* rejected version;
* "more technical";
* "less dry";
* reference paragraph;
* explicit user comparison.

---

# 18. Suggested Internal Data Shape

A conceptual representation could resemble:

```json
{
  "document": "...",
  "constraints": [
    {
      "type": "KEEP_MEANING",
      "source": "span_14",
      "semantic_unit": "Participants iteratively moved between prompting, editing and checking the source."
    },
    {
      "type": "KEEP_WORDING",
      "source": "span_27"
    },
    {
      "type": "MUST_COVER",
      "source": "section_5_3"
    }
  ],
  "direction": {
    "accepted_versions": ["v3"],
    "rejected_versions": ["v1", "v4"],
    "feedback": [
      "more technical",
      "less dry"
    ]
  }
}
```

This is illustrative rather than a fixed implementation contract.

---

# 19. UX Model

The editor should look like an editor first.

It should not look like a verification dashboard.

The verification machinery should appear only when useful.

Primary surface:

**Document**

Secondary surface:

**Prompt / transformation instruction**

Contextual actions after selecting text:

**Keep wording**

**Keep meaning**

**Must cover**

Potentially:

**Free to cut**

A lightweight side panel can show current constraints and coverage.

---

# 20. Example Interaction

Source contains approximately 1,000 words across four Results subsections.

The user selects one sentence.

**Keep wording**

The user selects another sentence.

**Keep meaning**

The user selects the four Results subsections.

**Must cover**

Prompt:

> Turn this into a tight Discussion paragraph. Make it much more concise.

Generation begins.

System detects:

5 required findings

4 represented

1 missing

The initial rewrite is rejected or repaired.

Generation retries.

Result:

5 / 5 required findings represented

protected sentence unchanged

protected idea retained

no unsupported major claims detected

1,000 → 210 words

The user reads it.

> Not this.

The system asks which direction is closer:

Technical / direct / explanatory

User chooses:

Technical

Next version appears.

User:

> Closer, but less dry.

Next version appears.

All semantic constraints remain active throughout the process.

This interaction demonstrates the whole product.

---

# 21. Killer Demo

The first public demo should communicate the concept without explanation.

### Scene 1 — Protect

User highlights a sentence.

**Keep wording**

Highlights an awkward but important idea.

**Keep meaning**

Highlights several source sections.

**Must cover**

### Scene 2 — Transform

Prompt:

> Make this section 70% shorter and much tighter.

The document visibly collapses.

### Scene 3 — Catch

Coverage panel:

4 / 5 findings represented

One finding turns red.

System:

> Missing required information — repairing.

### Scene 4 — Repair

The paragraph changes.

5 / 5 findings represented.

### Scene 5 — Steer

User:

> Not this.

Three directions appear.

User selects:

**More technical**

Then:

> Better. Less dry.

The text changes again.

Semantic constraints remain green.

### Final frame

**Rewrite freely. Keep what matters.**

This is substantially stronger than showing a generic ChatGPT rewrite followed by a diff extension.

---

# 22. MVP

The first implementation should prove the interaction rather than build a complete writing platform.

## Required

* plain-text / Markdown editing;
* select text;
* Keep Wording;
* Keep Meaning;
* Must Cover;
* natural-language editing prompt;
* LLM rewrite;
* extraction of semantic units from covered material;
* verification of protected meaning;
* coverage checking;
* basic grounding;
* reject / repair loop;
* "Not this" interaction;
* 2–3 direction alternatives;
* feedback such as "more technical" / "less dry";
* simple coverage UI;
* revision history sufficient to compare candidate directions.

## Useful but secondary

* deterministic number/date/citation checks;
* compression ratio;
* visible repair history;
* reference paragraph: "more like this."

---

# 23. Explicitly Out of Scope for MVP

Do not spend the first build on:

* DOCX editing;
* PDF editing;
* Google Docs integration;
* Word plugin;
* Overleaf plugin;
* browser extension;
* citation manager;
* accounts;
* authentication;
* collaboration;
* databases unless absolutely necessary;
* permanent user profiles;
* MCP;
* GitHub App;
* enterprise permissions;
* polished version-control system;
* advanced document layout;
* full reference-manager integration.

If users ask for these, that is useful demand evidence.

---

# 24. Primary MVP Technical Question

Before investing heavily in UI, test:

> **Can the verifier reliably distinguish allowed aggressive rewriting from genuine semantic loss?**

Specifically:

Can it allow:

> 12 participants completed the experiment.

→

> The experiment involved 12 participants.

while rejecting:

> 10 participants completed the experiment.

And can it recognize that:

> Participants repeatedly moved between A and B.

is still represented by:

> Their workflow iteratively alternated between A and B.

Coverage must tolerate substantial paraphrase.

Otherwise the product will become too conservative to be useful.

---

# 25. Evaluation Set

Build a small adversarial benchmark before polishing the application.

Test categories should include:

* harmless paraphrase;
* aggressive paraphrase;
* structural movement;
* sentence merging;
* sentence splitting;
* omission;
* numeric drift;
* changed certainty;
* changed causality;
* changed scope;
* removed qualification;
* source finding represented using completely different wording;
* source finding genuinely missing;
* unsupported addition;
* legitimate inference;
* protected meaning preserved;
* protected meaning subtly altered;
* exact wording violation;
* cross-section dependency maintained;
* dependency broken.

The key metrics are not just accuracy.

Also measure:

**False blocking rate**

How often does the verifier reject a perfectly acceptable rewrite?

This is critical.

A system that catches every possible loss by rejecting half of all legitimate rewrites is unusable.

**Miss rate**

How often does meaningful information disappear without being detected?

**Repair success**

After a rejected candidate, can the generative model produce a compliant alternative?

**Latency**

Can verification happen fast enough to feel interactive?

**Cost**

Can multiple checks run per rewrite without destroying the economics?

---

# 26. Kill Criteria

Pivot if the core semantic-verification loop proves too unreliable.

Warning signs:

* harmless paraphrases trigger constant warnings;
* subtle meaning loss regularly goes undetected;
* coverage checks require such literal similarity that the writer loses freedom;
* users spend more effort configuring constraints than reviewing ordinary AI output;
* automatic repair repeatedly oscillates or degrades prose;
* Jev performs materially worse than a conventional verifier without meaningful latency/cost benefits;
* users understand the problem but do not care enough to change their editing workflow.

The product depends on allowing **high freedom in wording with high confidence in retained information**.

If that separation cannot be achieved, the main differentiator collapses.

---

# 27. Longer-Term Capabilities

If the core works, the same model can expand significantly.

## Document-level semantic graph

Track relationships across an entire artifact.

## Semantic regression tests

Users explicitly define invariants such as:

> Never imply this feature has shipped.

> Every recommendation remains conditional on administrator approval.

> Distinguish paying customers from total users.

These continue to run during editing.

## Cross-document synthesis

Ensure a new output represents required information from several files.

## Source-aware summaries

Generate summaries with auditable semantic coverage.

## Requirements editing

Rewrite or reorganize specifications without dropping requirements.

## Contract simplification

Make text easier to read while preserving obligations, exceptions, dates, and conditions.

## Technical documentation

Rewrite docs while preserving API behavior and stated constraints.

## Collaborative documents

Different users can own or protect different information requirements.

---

# 28. Broader Product Abstraction

The document editor is the first surface.

The deeper abstraction is:

> **Transform an artifact freely while preserving user-defined semantic invariants and dependencies.**

General form:

BEFORE

* desired transformation
* semantic constraints
* source dependencies
  ↓
  GENERATIVE TRANSFORMATION
  ↓
  CONTINUOUS VERIFICATION
  ↓
  VALID OUTPUT

This could eventually apply beyond prose.

But the first product should remain focused on writing because the problem is understandable immediately and the failures are easy to demonstrate.

---

# 29. Product Positioning

Do not position it primarily as:

* an AI grammar checker;
* a semantic diff;
* a hallucination detector;
* a summarizer;
* a writing assistant;
* a fact checker;
* a safer ChatGPT.

The broader category is:

> **AI editing with explicit control over information preservation.**

The central conceptual contrast is:

Traditional editor:

**Control the words.**

Generative editor:

**Tell AI what to write.**

Lossless Rewrite:

**Control what must remain true while AI changes the writing.**

---

# 30. Working Messaging

## Product name

**Lossless Rewrite**

The name is memorable and communicates the aspiration, although the underlying semantic checks are probabilistic and must not be presented as mathematical guarantees.

## Primary line

**Rewrite freely. Keep what matters.**

## Alternative explanatory line

**Change the writing without losing the information.**

## Deeper product explanation

**AI editing where you control the information while the model explores the writing.**

## Direction-finding message

**You don't need to know the perfect prompt. You only need to know when it's getting closer.**

## Compression-oriented message

**Compress the text, not the information.**

These can coexist in the README/demo rather than forcing one sentence to explain the entire product.

---

# 31. Why Jev

The project should demonstrate a use case where a decision model has a structural advantage rather than merely attaching Jev to an existing workflow.

A single generated rewrite may require dozens of independent judgments:

* F1 preserved?
* F2 preserved?
* F3 preserved?
* protected meaning retained?
* unsupported claim introduced?
* certainty changed?
* candidate closer to accepted direction?
* candidate less similar to rejected direction?
* relationship R4 still valid?

These are narrow, structured decisions.

That makes the architecture:

**large generative model proposes**

*

**small fast evaluator judges many properties**

*

**ordinary code determines what happens next**

This is a much stronger Jev demonstration than asking Jev to perform one generic document classification.

---

# 32. Two-Day Prototype Plan

### Phase 1 — Prove verification

Create approximately 30–50 hand-authored before/source/output examples.

Implement:

* semantic-unit extraction;
* Keep Meaning verification;
* Must Cover verification;
* simple grounding verification.

Test Jev.

Compare against at least one conventional LLM verifier.

Stop if the results are poor.

### Phase 2 — Build editing loop

Create a minimal editor.

Support:

* text selection;
* Keep Wording;
* Keep Meaning;
* Must Cover;
* rewrite instruction;
* generated candidate;
* verification;
* automatic retry.

### Phase 3 — Add steering

Add:

* Not this;
* three deliberately different alternatives;
* choose direction;
* one follow-up modifier such as "less dry."

### Phase 4 — Demo

Create one exceptionally clear scenario.

Do not demonstrate ten use cases.

Use one high-information document where:

* substantial compression occurs;
* a required idea is lost;
* the system catches it;
* the system repairs it;
* the user rejects the prose;
* the user steers the style;
* all constraints remain satisfied.

That single workflow should explain the repo.

---

# 33. What Success Looks Like

The prototype succeeds if somebody watching a 15–30 second demo immediately understands:

1. why ordinary AI editing is risky;
2. why this is different from Track Changes;
3. what Keep Meaning means;
4. what semantic coverage means;
5. why verification is useful during generation rather than after it;
6. why "Not this → more like this" is more natural than prompt engineering;
7. and why they might want the same workflow for their own important writing.

The strongest reaction is not:

> Cool Jev demo.

It is:

> **I have exactly this problem.**

---

# 34. One-Sentence Product Definition

> **Lossless Rewrite is an AI editor that lets users aggressively transform writing while explicitly controlling which words, ideas, source information, and relationships must survive—and helps them iteratively discover the writing direction they want.**

---

# 35. The Product in Four Verbs

If the entire system needs to be mentally compressed:

**Preserve. Cover. Ground. Steer.**

**Preserve** what must survive.

**Cover** the source information that must appear.

**Ground** new writing in the material it comes from.

**Steer** the expression until it feels right.

Everything else in the product should support one of these four operations.
