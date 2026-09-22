import type { RequiredUnit } from "../lib/coverage/questions";

/**
 * Hand-labelled coverage benchmark. Each scenario is a source passage, the required units a
 * user would mark (Must cover facts and Keep meaning selections), and several rewrites of it.
 * Every unit in every rewrite is labelled:
 *
 * - `present`: the rewrite states the claim with the same meaning (any wording).
 * - `missing`: the rewrite does not state the claim. `near_miss` marks the dangerous version,
 *   where a sentence about the same topic or a neighbouring finding sits nearby.
 * - `altered`: the rewrite states the claim but changes its meaning, or keeps only part of it.
 *
 * `missing` and `altered` must both be flagged; a verifier that passes them is a false green.
 * All passages are synthetic.
 */

export type Status = "present" | "missing" | "altered";

export type Tag =
  | "strong_paraphrase"
  | "merge"
  | "split"
  | "near_miss"
  | "omission"
  | "partial"
  | "certainty"
  | "scope"
  | "causal"
  | "qualifier"
  | "polarity"
  | "numbers"
  | "fact";

export interface Label {
  status: Status;
  /** 1-based sentence numbers that state the claim (present units only). */
  at?: number[];
  tags?: Tag[];
  why?: string;
}

export interface Rewrite {
  id: string;
  note: string;
  sentences: string[];
  labels: Record<string, Label>;
}

export interface Scenario {
  id: string;
  domain: string;
  source: string;
  units: RequiredUnit[];
  rewrites: Rewrite[];
}

const P = (at: number[], ...tags: Tag[]): Label => ({ status: "present", at, tags });
const M = (why: string, ...tags: Tag[]): Label => ({ status: "missing", why, tags });
const A = (why: string, ...tags: Tag[]): Label => ({ status: "altered", why, tags });

export const SCENARIOS: Scenario[] = [
  {
    id: "tandem",
    domain: "HCI user study",
    source:
      "Twelve professional developers (4 women, 8 men; median experience 7 years) completed both conditions. With Tandem, pairs finished the refactoring task in a median of 31 minutes, compared with 44 minutes using screen sharing (Wilcoxon signed-rank, p = .02). The effect was driven mainly by the navigation phase: pairs spent less time locating the code under discussion, while time spent editing was similar across conditions. Participants rated shared cursors as the most useful feature (10 of 12), but several found the live-follow mode disorienting when the partner scrolled quickly. Pairs switched driver and navigator roles more often with Tandem (median 9 switches versus 3), although role switches were not associated with task time. Three pairs reported that the voice channel lagged behind edits, which led them to narrate their actions explicitly. We did not observe differences in code quality between conditions, as assessed by two independent reviewers.",
    units: [
      { id: "F1", kind: "must_cover", text: "With Tandem, pairs completed the refactoring task faster than with screen sharing (median 31 vs 44 minutes, p = .02)." },
      { id: "F2", kind: "must_cover", text: "The speed-up came mainly from less time spent locating the code under discussion; time spent editing was similar across conditions." },
      { id: "F3", kind: "must_cover", text: "Participants rated shared cursors as the most useful feature (10 of 12)." },
      { id: "F4", kind: "must_cover", text: "Several participants found live-follow mode disorienting when their partner scrolled quickly." },
      { id: "F5", kind: "must_cover", text: "Pairs switched driver and navigator roles more often with Tandem (median 9 vs 3 switches), but role switches were not associated with task time." },
      { id: "P1", kind: "keep_meaning", text: "Three pairs reported that the voice channel lagged behind edits, which led them to narrate their actions explicitly." },
      { id: "F6", kind: "must_cover", text: "Code quality did not differ between conditions, as assessed by two independent reviewers." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "aggressive compression, strong paraphrase and merging; everything survives",
        sentences: [
          "Across twelve experienced developers, Tandem cut median task time from 44 to 31 minutes relative to screen sharing (p = .02), almost entirely by shortening the search for the code under discussion rather than the editing itself.",
          "Participants singled out shared cursors as the most valuable feature (10 of 12), although fast scrolling by a partner made live-follow disorienting for several of them.",
          "Roles changed hands far more often (median 9 vs. 3 switches), without any link to how long pairs took.",
          "Because audio lagged behind their edits, three pairs took to narrating what they were doing.",
          "Two independent reviewers found no difference in code quality between the setups.",
        ],
        labels: {
          F1: P([1], "strong_paraphrase"),
          F2: P([1], "merge", "strong_paraphrase"),
          F3: P([2]),
          F4: P([2], "merge", "strong_paraphrase"),
          F5: P([3], "strong_paraphrase"),
          P1: P([4], "strong_paraphrase"),
          F6: P([5]),
        },
      },
      {
        id: "omissions",
        note: "F2 replaced by a near miss, F4 simply dropped",
        sentences: [
          "Tandem let pairs of developers finish the refactoring task faster than screen sharing (median 31 vs. 44 minutes, p = .02).",
          "Navigation and editing both took place in the shared workspace, and participants valued its shared cursors most (10 of 12).",
          "Pairs swapped driver and navigator roles more often with Tandem (median 9 vs. 3), but this was unrelated to task time.",
          "Three pairs narrated their actions aloud because the voice channel lagged behind their edits.",
          "Code quality, judged by two independent reviewers, was comparable across conditions.",
        ],
        labels: {
          F1: P([1]),
          F2: M("mentions navigation and editing, not where the speed-up came from", "near_miss"),
          F3: P([2], "merge"),
          F4: M("live-follow is never mentioned", "omission"),
          F5: P([3]),
          P1: P([4]),
          F6: P([5]),
        },
      },
      {
        id: "distortions",
        note: "claims survive in shape but change meaning",
        sentences: [
          "Tandem helped pairs finish the refactoring task faster than screen sharing (median 31 vs. 44 minutes, p = .02) by speeding up both navigating and editing.",
          "All participants rated shared cursors as the most useful feature, and several found live-follow disorienting when a partner scrolled quickly.",
          "Because Tandem made pairs switch roles more often (median 9 vs. 3), they finished sooner.",
          "Three pairs reported that the voice channel lagged behind edits, which led them to narrate their actions explicitly.",
          "Code quality did not differ between conditions according to two independent reviewers.",
        ],
        labels: {
          F1: P([1]),
          F2: A("editing time was similar; the rewrite says editing sped up too", "polarity"),
          F3: A("10 of 12 became all participants", "scope", "numbers"),
          F4: P([2], "merge"),
          F5: A("no association with task time became a cause of finishing sooner", "causal"),
          P1: P([4]),
          F6: P([5]),
        },
      },
      {
        id: "near-misses",
        note: "each missing fact leaves a related sentence behind",
        sentences: [
          "Pairs using Tandem were faster than with screen sharing (median 31 vs. 44 minutes, p = .02).",
          "Time spent editing was similar across conditions.",
          "Participants discussed which features they found useful and which they found distracting.",
          "Role switches were more frequent with Tandem (median 9 vs. 3) and were not associated with task time.",
          "Three pairs narrated their actions because the voice channel lagged behind their edits.",
          "Two independent reviewers assessed code quality in both conditions.",
        ],
        labels: {
          F1: P([1]),
          F2: A("keeps 'editing similar' but drops that the gain came from locating code", "partial"),
          F3: M("talks about useful features in general", "near_miss"),
          F4: M("talks about distracting features in general", "near_miss"),
          F5: P([4]),
          P1: P([5]),
          F6: M("says quality was assessed, not what was found", "near_miss"),
        },
      },
    ],
  },
  {
    id: "velorant",
    domain: "clinical trial",
    source:
      "In the intention-to-treat population (n = 412), velorant reduced monthly migraine days by 3.1 days compared with 1.9 days for placebo (difference −1.2 days; 95% CI −1.9 to −0.5). The benefit was confined to patients with episodic migraine; in patients with chronic migraine the difference was not statistically significant. Response rates, defined as at least a 50% reduction in migraine days, were 38% with velorant and 24% with placebo. The most common adverse event was mild nausea (11% vs 4%), which resolved within two weeks in most patients. Serious adverse events were rare and occurred at similar rates in both groups. Because the trial lasted 12 weeks, it could not assess whether the effect persists beyond three months. Exploratory analyses suggested that patients with aura may respond better, but this subgroup was small and the finding requires confirmation.",
    units: [
      { id: "F1", kind: "must_cover", text: "Velorant reduced monthly migraine days more than placebo (3.1 vs 1.9 days; difference −1.2, 95% CI −1.9 to −0.5)." },
      { id: "F2", kind: "must_cover", text: "The benefit was confined to episodic migraine; in chronic migraine the difference was not statistically significant." },
      { id: "F3", kind: "must_cover", text: "Response rates (at least a 50% reduction in migraine days) were 38% with velorant and 24% with placebo." },
      { id: "F4", kind: "must_cover", text: "Mild nausea was the most common adverse event (11% vs 4%) and resolved within two weeks in most patients." },
      { id: "F5", kind: "must_cover", text: "Serious adverse events were rare and occurred at similar rates in both groups." },
      { id: "F6", kind: "must_cover", text: "The 12-week trial could not assess whether the effect persists beyond three months." },
      { id: "P1", kind: "keep_meaning", text: "Exploratory analyses suggested that patients with aura may respond better, but this subgroup was small and the finding requires confirmation." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "compressed, merged, 'at least halved' for 'at least a 50% reduction'",
        sentences: [
          "Velorant cut monthly migraine days by 3.1 versus 1.9 with placebo (difference −1.2; 95% CI −1.9 to −0.5), and 38% versus 24% of patients at least halved their migraine days.",
          "That advantage held only for episodic migraine; chronic migraine showed no significant difference.",
          "Nausea, mostly mild and usually gone within two weeks, was the main side effect (11% vs. 4%), while serious events were rare and balanced across arms.",
          "A possibly better response in patients with aura emerged only from small exploratory analyses and still needs confirmation.",
          "With 12 weeks of follow-up, whether the effect lasts beyond three months is unknown.",
        ],
        labels: {
          F1: P([1], "merge"),
          F2: P([2], "strong_paraphrase"),
          F3: P([1], "merge", "strong_paraphrase"),
          F4: P([3], "merge", "strong_paraphrase"),
          F5: P([3], "merge"),
          F6: P([5], "strong_paraphrase"),
          P1: P([4], "strong_paraphrase"),
        },
      },
      {
        id: "distortions",
        note: "scope, certainty and polarity changes",
        sentences: [
          "Velorant reduced monthly migraine days more than placebo (3.1 vs. 1.9; difference −1.2, 95% CI −1.9 to −0.5).",
          "The benefit was seen in both episodic and chronic migraine.",
          "Response rates, defined as at least a 50% reduction in migraine days, were 38% versus 24%.",
          "Mild nausea was the most common adverse event (11% vs. 4%) and resolved within two weeks in most patients.",
          "Serious adverse events were rare and occurred at similar rates in both groups.",
          "Patients with aura respond better to velorant.",
          "The effect persists beyond three months.",
        ],
        labels: {
          F1: P([1]),
          F2: A("confined to episodic became seen in both", "scope", "polarity"),
          F3: P([3]),
          F4: P([4]),
          F5: P([5]),
          F6: A("could not assess became persists", "certainty"),
          P1: A("a tentative exploratory finding became a flat claim", "certainty", "qualifier"),
        },
      },
      {
        id: "near-misses",
        note: "12 weeks, enrolment and nausea mentioned without the findings",
        sentences: [
          "Over 12 weeks, velorant reduced monthly migraine days relative to placebo (3.1 vs. 1.9; difference −1.2, 95% CI −1.9 to −0.5).",
          "Patients with both episodic and chronic migraine were enrolled.",
          "Response rates, defined as at least a 50% reduction in migraine days, favoured velorant (38% vs. 24%).",
          "Adverse events were monitored throughout, and nausea was reported in both arms.",
          "Serious adverse events were rare and similar across groups.",
          "Exploratory analyses suggested a possibly better response in patients with aura, although the subgroup was small and the finding needs confirmation.",
        ],
        labels: {
          F1: P([1]),
          F2: M("says both types were enrolled, not where the benefit was", "near_miss"),
          F3: P([3]),
          F4: M("mentions nausea, not that it was the most common, mild and short-lived", "near_miss"),
          F5: P([5]),
          F6: M("mentions the 12 weeks, not the limit on persistence", "near_miss"),
          P1: P([6]),
        },
      },
      {
        id: "paraphrase-and-drift",
        note: "strong paraphrase everywhere, one number changed",
        sentences: [
          "Patients on velorant had about 3.1 fewer migraine days a month, against 1.9 for placebo (difference −1.2 days; 95% CI −1.9 to −0.5).",
          "Only people whose migraines were episodic, not chronic, benefited to a statistically significant degree.",
          "38% of velorant patients and 24% of placebo patients saw their migraine days fall by half or more.",
          "Nausea, the commonest side effect, affected 17% versus 4% of patients; it was mild and in most cases cleared within two weeks.",
          "Serious adverse events were uncommon, with no imbalance between arms.",
          "Whether benefits last past three months could not be judged from a 12-week study.",
          "In exploratory analyses, patients with aura may have responded better, but the subgroup was small and this needs confirmation.",
        ],
        labels: {
          F1: P([1], "strong_paraphrase"),
          F2: P([2], "strong_paraphrase"),
          F3: P([3], "strong_paraphrase"),
          F4: A("11% became 17%", "numbers"),
          F5: P([5], "strong_paraphrase"),
          F6: P([6], "strong_paraphrase"),
          P1: P([7]),
        },
      },
    ],
  },
  {
    id: "export",
    domain: "software requirements",
    source:
      "The export service shall generate CSV files for any report with fewer than 100,000 rows; larger reports shall be exported asynchronously and delivered by email link. Export links shall expire after 7 days. Only users with the Analyst or Admin role may export reports containing personal data; other users shall receive a version with personal data columns removed. The service should retry failed exports up to three times with exponential backoff, except when the failure is caused by a permissions error, which shall not be retried. All exports shall be logged with the requesting user, report ID, and timestamp, and logs shall be retained for 400 days. The user interface may display an estimated completion time, but this is not required for the first release.",
    units: [
      { id: "F1", kind: "must_cover", text: "Reports with fewer than 100,000 rows are exported directly as CSV; larger reports are exported asynchronously and delivered by email link." },
      { id: "F2", kind: "must_cover", text: "Export links expire after 7 days." },
      { id: "F3", kind: "must_cover", text: "Only Analyst and Admin users may export reports containing personal data; other users receive a version with personal data columns removed." },
      { id: "F4", kind: "must_cover", text: "Failed exports are retried up to three times with exponential backoff, except permission errors, which are not retried." },
      { id: "F5", kind: "must_cover", text: "Every export is logged with the requesting user, report ID and timestamp, and logs are retained for 400 days." },
      { id: "P1", kind: "keep_meaning", text: "The user interface may display an estimated completion time, but this is not required for the first release." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "plain-language compression",
        sentences: [
          "Reports under 100,000 rows export straight to CSV, while bigger ones run asynchronously and arrive as an emailed link that stays valid for 7 days.",
          "Only Analysts and Admins can export personal data; everyone else gets the report with those columns stripped.",
          "A failed export gets up to three retries with exponential backoff, unless a permissions error caused it, in which case it is not retried.",
          "Each export is logged with the user, report ID and timestamp, and the logs are kept for 400 days.",
          "Showing an estimated completion time is optional and not needed for the first release.",
        ],
        labels: {
          F1: P([1], "merge", "strong_paraphrase"),
          F2: P([1], "merge", "strong_paraphrase"),
          F3: P([2], "strong_paraphrase"),
          F4: P([3]),
          F5: P([4]),
          P1: P([5], "strong_paraphrase"),
        },
      },
      {
        id: "distortions",
        note: "a lost exception, a scope change and 'may' turned into 'shall'",
        sentences: [
          "Reports under 100,000 rows are exported directly as CSV; larger ones are exported asynchronously and delivered by email link.",
          "Export links expire after 7 days.",
          "Users without the Analyst or Admin role cannot export reports.",
          "Failed exports shall be retried up to three times with exponential backoff.",
          "All exports are logged with user, report ID and timestamp, and logs are retained for 400 days.",
          "The user interface shall display an estimated completion time in the first release.",
        ],
        labels: {
          F1: P([1]),
          F2: P([2]),
          F3: A("other users get a redacted report; the rewrite says they cannot export at all", "scope"),
          F4: A("the permission-error exception is gone", "qualifier"),
          F5: P([5]),
          P1: A("optional became required", "certainty", "polarity"),
        },
      },
      {
        id: "partials",
        note: "requirements lose their thresholds and retention; one near miss",
        sentences: [
          "The service exports reports as CSV, handling large reports asynchronously.",
          "Download links are sent to the user by email.",
          "Whether personal data can be exported depends on role: Analysts and Admins may export it, while other users receive the report without personal data columns.",
          "Failed exports are retried with exponential backoff up to three times, but permission errors are not retried.",
          "The requesting user, report ID and timestamp are recorded for every export.",
          "An estimated completion time may be shown, though the first release does not require it.",
        ],
        labels: {
          F1: A("the 100,000-row threshold and email delivery are gone", "partial"),
          F2: M("links are mentioned, their expiry is not", "near_miss"),
          F3: P([3], "strong_paraphrase"),
          F4: P([4]),
          F5: A("the 400-day retention is gone", "partial"),
          P1: P([6]),
        },
      },
      {
        id: "near-misses",
        note: "vague sentences stand in for specific requirements",
        sentences: [
          "Small reports (under 100,000 rows) are exported directly as CSV files, and larger reports are generated asynchronously and delivered through an email link.",
          "A link is generated for every export and sent to the requesting user.",
          "Role-based permissions apply to exports.",
          "Failed exports are retried up to three times with exponential backoff, except for permission errors.",
          "Export activity is logged for auditing.",
          "The user interface may show an estimated completion time; this is optional for the first release.",
        ],
        labels: {
          F1: P([1]),
          F2: M("a link is mentioned, its expiry is not", "near_miss"),
          F3: M("roles are mentioned, not the personal-data rule", "near_miss"),
          F4: P([4]),
          F5: M("logging is mentioned, not its fields or retention", "near_miss"),
          P1: P([6]),
        },
      },
    ],
  },
  {
    id: "contract",
    domain: "contract clause",
    source:
      "Either party may terminate this Agreement for convenience on 90 days' written notice, provided that no termination for convenience may take effect before the first anniversary of the Effective Date. Either party may terminate immediately by written notice if the other party materially breaches this Agreement and fails to cure the breach within 30 days of receiving notice of it. Upon termination, the Customer shall pay all fees accrued up to the termination date; prepaid fees for services not yet rendered shall be refunded pro rata, except where the Customer terminates for convenience. The Supplier's total liability under this Agreement shall not exceed the fees paid in the twelve months preceding the claim, except for liability arising from gross negligence, wilful misconduct, or breach of confidentiality, which is uncapped. Sections 7 (Confidentiality) and 9 (Liability) survive termination.",
    units: [
      { id: "F1", kind: "must_cover", text: "Either party may terminate for convenience on 90 days' written notice, but no such termination may take effect before the first anniversary of the Effective Date." },
      { id: "F2", kind: "must_cover", text: "Either party may terminate immediately if the other party materially breaches the Agreement and fails to cure the breach within 30 days of notice." },
      { id: "F3", kind: "must_cover", text: "On termination, the Customer pays all fees accrued up to the termination date." },
      { id: "F4", kind: "must_cover", text: "Prepaid fees for services not yet rendered are refunded pro rata, except where the Customer terminates for convenience." },
      { id: "F5", kind: "must_cover", text: "The Supplier's liability is capped at the fees paid in the twelve months before the claim, except for gross negligence, wilful misconduct or breach of confidentiality, which are uncapped." },
      { id: "F6", kind: "must_cover", text: "The confidentiality and liability sections survive termination." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "plain-language version of the whole clause",
        sentences: [
          "Either side can end the contract without cause by giving 90 days' written notice, but such an exit cannot take effect during the first year.",
          "Either side can also end it at once if the other seriously breaches it and does not fix the problem within 30 days of being told.",
          "When the contract ends, the Customer pays what it owes up to that date and gets back unused prepaid fees in proportion, unless the Customer itself walked away without cause.",
          "The Supplier's liability tops out at the fees paid over the twelve months before a claim, except for gross negligence, wilful misconduct or confidentiality breaches, which have no cap.",
          "The confidentiality and liability sections continue to apply after termination.",
        ],
        labels: {
          F1: P([1], "strong_paraphrase"),
          F2: P([2], "strong_paraphrase"),
          F3: P([3], "merge", "strong_paraphrase"),
          F4: P([3], "merge", "strong_paraphrase"),
          F5: P([4], "strong_paraphrase"),
          F6: P([5]),
        },
      },
      {
        id: "lost-exceptions",
        note: "every exception and proviso dropped",
        sentences: [
          "Either party may terminate for convenience on 90 days' written notice.",
          "Either party may terminate immediately for a material breach that is not cured within 30 days of notice.",
          "On termination, the Customer pays all accrued fees and receives a pro rata refund of prepaid fees for services not yet rendered.",
          "The Supplier's liability is capped at the fees paid in the twelve months before the claim.",
          "The confidentiality and liability obligations survive termination.",
        ],
        labels: {
          F1: A("the first-anniversary proviso is gone", "qualifier"),
          F2: P([2]),
          F3: P([3], "merge"),
          F4: A("the refund exception for the Customer's own convenience exit is gone", "qualifier"),
          F5: A("the uncapped exceptions are gone", "qualifier"),
          F6: P([5]),
        },
      },
      {
        id: "near-misses",
        note: "vague sentences stand in for specific terms",
        sentences: [
          "Either party's termination for convenience requires 90 days' written notice and cannot take effect before the first anniversary of the Effective Date.",
          "A material breach must be notified in writing.",
          "Fees are settled according to the payment terms when the Agreement ends.",
          "The Supplier's liability is limited to the fees paid in the twelve months preceding the claim, but liability for gross negligence, wilful misconduct or breach of confidentiality is unlimited.",
          "Some provisions survive termination.",
        ],
        labels: {
          F1: P([1]),
          F2: M("breach notice is mentioned, not the right to terminate", "near_miss"),
          F3: M("fees are mentioned, not what the Customer pays", "near_miss"),
          F4: M("fees are mentioned, not the refund rule", "near_miss"),
          F5: P([4], "strong_paraphrase"),
          F6: M("'some provisions' does not say which", "near_miss"),
        },
      },
      {
        id: "numbers-and-scope",
        note: "a changed notice period and a broadened breach right",
        sentences: [
          "Either party may terminate for convenience on 60 days' written notice, though not before the first anniversary of the Effective Date.",
          "Either party may terminate immediately for any breach.",
          "The Customer pays all fees accrued up to the termination date.",
          "Prepaid fees for services not yet rendered are refunded pro rata, except where the Customer terminates for convenience.",
          "The Supplier's total liability is capped at the fees paid in the prior twelve months, with no cap for gross negligence, wilful misconduct or breach of confidentiality.",
          "Sections 7 (Confidentiality) and 9 (Liability) survive termination.",
        ],
        labels: {
          F1: A("90 days became 60 days", "numbers"),
          F2: A("material, uncured breach became any breach", "scope", "qualifier"),
          F3: P([3]),
          F4: P([4]),
          F5: P([5]),
          F6: P([6]),
        },
      },
    ],
  },
  {
    id: "batch-api",
    domain: "API documentation",
    source:
      "The /v2/batch endpoint accepts up to 500 operations per request; requests exceeding this limit are rejected with HTTP 413 rather than truncated. Operations within a batch are executed in order, but they are not atomic: if an operation fails, earlier operations remain applied and later ones still run. Each failed operation is reported individually in the response with its index and error code. Batch requests count as a single request against the rate limit of 100 requests per minute, but each operation still counts toward the daily quota. Idempotency keys are supported and are retained for 24 hours; retrying a request with the same key within that window returns the original response without re-executing operations. The endpoint is not available on the Free plan.",
    units: [
      { id: "F1", kind: "must_cover", text: "The /v2/batch endpoint accepts up to 500 operations per request; larger requests are rejected with HTTP 413 rather than truncated." },
      { id: "F2", kind: "must_cover", text: "Operations run in order but are not atomic: if one fails, earlier operations stay applied and later ones still run." },
      { id: "F3", kind: "must_cover", text: "Each failed operation is reported individually with its index and error code." },
      { id: "F4", kind: "must_cover", text: "A batch counts as one request toward the rate limit of 100 requests per minute, but each operation counts toward the daily quota." },
      { id: "F5", kind: "must_cover", text: "Idempotency keys are retained for 24 hours; a retry with the same key within that window returns the original response without re-executing operations." },
      { id: "F6", kind: "must_cover", text: "The endpoint is not available on the Free plan." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "developer-friendly compression",
        sentences: [
          "Send up to 500 operations per call to /v2/batch; anything larger is rejected with HTTP 413 instead of being cut short.",
          "Operations execute in sequence without transactional guarantees: an error neither undoes earlier operations nor stops later ones, and every failure is listed separately with its index and error code.",
          "Rate limiting counts the whole batch as a single request (100 per minute), yet the daily quota is charged per operation.",
          "Reusing an idempotency key within 24 hours returns the first response without running anything again.",
          "Free-plan accounts cannot use the endpoint.",
        ],
        labels: {
          F1: P([1], "strong_paraphrase"),
          F2: P([2], "merge", "strong_paraphrase"),
          F3: P([2], "merge"),
          F4: P([3], "strong_paraphrase"),
          F5: P([4], "strong_paraphrase"),
          F6: P([5], "strong_paraphrase"),
        },
      },
      {
        id: "distortions",
        note: "reversed behaviours",
        sentences: [
          "The /v2/batch endpoint accepts up to 500 operations per request and truncates larger requests to the first 500.",
          "Operations run in order and a batch is atomic: if one fails, the whole batch is rolled back.",
          "Each failed operation is reported with its index and error code.",
          "Each batch counts as a single request against both the rate limit of 100 requests per minute and the daily quota.",
          "Idempotency keys are retained for 24 hours, and a retry with the same key within that window returns the original response without re-executing operations.",
          "The endpoint is not available on the Free plan.",
        ],
        labels: {
          F1: A("rejected became truncated", "polarity"),
          F2: A("not atomic became atomic", "polarity"),
          F3: P([3]),
          F4: A("the quota is charged per batch instead of per operation", "fact"),
          F5: P([5]),
          F6: P([6]),
        },
      },
      {
        id: "near-misses",
        note: "generic sentences stand in for specific behaviour",
        sentences: [
          "Batches are limited to 500 operations, and oversized requests are rejected with HTTP 413.",
          "Operations are processed in the order they appear in the request.",
          "The response includes an error code when something goes wrong.",
          "Batch requests are subject to rate limits and daily quotas.",
          "Idempotency keys are retained for 24 hours; a retry with the same key within that window returns the original response without executing the operations again.",
          "Plan restrictions may apply.",
        ],
        labels: {
          F1: P([1]),
          F2: A("keeps the ordering, drops that batches are not atomic", "partial", "near_miss"),
          F3: M("an error code is mentioned, not per-operation reporting with indexes", "near_miss"),
          F4: M("limits are mentioned, not how batches count against them", "near_miss"),
          F5: P([5]),
          F6: M("'plan restrictions' does not say the Free plan is excluded", "near_miss"),
        },
      },
      {
        id: "split-paraphrase",
        note: "claims split across sentences and heavily reworded; 24 hours becomes 'a day'",
        sentences: [
          "Keep batches to 500 operations or fewer.",
          "Go over that and the API refuses the whole request with a 413; it will not quietly drop the extras.",
          "Each operation runs in sequence.",
          "There is no rollback: an operation that errors leaves earlier changes in place, and the rest of the batch keeps going.",
          "You get a per-operation error report with the index and code of every failure.",
          "For rate limiting (100 per minute) a batch is one call, while the daily quota counts each operation.",
          "Idempotency keys expire after a day, and a repeat within that day gets back the original result with nothing re-run.",
          "Free-plan users do not have access to the endpoint.",
        ],
        labels: {
          F1: P([1, 2], "split", "strong_paraphrase"),
          F2: P([3, 4], "split", "strong_paraphrase"),
          F3: P([5], "strong_paraphrase"),
          F4: P([6], "strong_paraphrase"),
          F5: P([7], "strong_paraphrase"),
          F6: P([8]),
        },
      },
    ],
  },
  {
    id: "hybrid-survey",
    domain: "survey report",
    source:
      "Of the 2,340 employees surveyed, 61% reported that hybrid work improved their ability to focus, while 18% reported the opposite. Improvements were most pronounced among employees with caregiving responsibilities. Employees who worked remotely more than three days a week were more likely to report feeling disconnected from their team, although this association weakened after controlling for tenure. Managers were less positive than individual contributors about hybrid work's effect on collaboration. Because the survey was cross-sectional, it cannot establish whether hybrid work caused these differences. Response rates were lower in the manufacturing division (34%) than elsewhere (average 71%), so results may not represent that division.",
    units: [
      { id: "F1", kind: "must_cover", text: "Of 2,340 employees surveyed, 61% said hybrid work improved their ability to focus and 18% said it worsened it." },
      { id: "F2", kind: "must_cover", text: "Focus improvements were most pronounced among employees with caregiving responsibilities." },
      { id: "F3", kind: "must_cover", text: "Working remotely more than three days a week was associated with feeling disconnected from the team, but the association weakened after controlling for tenure." },
      { id: "F4", kind: "must_cover", text: "Managers were less positive than individual contributors about hybrid work's effect on collaboration." },
      { id: "P1", kind: "keep_meaning", text: "Because the survey was cross-sectional, it cannot establish whether hybrid work caused these differences." },
      { id: "F5", kind: "must_cover", text: "Response rates were lower in the manufacturing division (34%) than elsewhere (average 71%), so results may not represent that division." },
    ],
    rewrites: [
      {
        id: "faithful",
        note: "compressed and reworded",
        sentences: [
          "Among 2,340 respondents, hybrid work helped focus for 61% and hurt it for 18%, with caregivers gaining the most.",
          "People remote more than three days a week felt more cut off from their teams, a link that shrank once tenure was taken into account.",
          "Managers took a dimmer view than individual contributors of hybrid work's effect on collaboration.",
          "As a single cross-sectional snapshot, the survey cannot show that hybrid work caused any of this.",
          "Manufacturing responded at only 34% (against 71% elsewhere), so its results may be unrepresentative.",
        ],
        labels: {
          F1: P([1], "merge", "strong_paraphrase"),
          F2: P([1], "merge", "strong_paraphrase"),
          F3: P([2], "strong_paraphrase"),
          F4: P([3], "strong_paraphrase"),
          P1: P([4], "strong_paraphrase"),
          F5: P([5], "strong_paraphrase"),
        },
      },
      {
        id: "distortions",
        note: "scope, causality and the causal disclaimer reversed",
        sentences: [
          "Hybrid work improved focus for 61% of the 2,340 employees surveyed and worsened it for 18%.",
          "Only employees with caregiving responsibilities saw their focus improve.",
          "Working remotely more than three days a week makes employees feel disconnected from their team.",
          "Managers were less positive than individual contributors about hybrid work's effect on collaboration.",
          "Hybrid work caused these differences in focus and connection.",
          "Response rates were lower in manufacturing (34% vs. 71% on average), so results may not represent that division.",
        ],
        labels: {
          F1: P([1]),
          F2: A("most pronounced became only", "scope"),
          F3: A("an association that weakens with tenure became a cause", "causal", "qualifier"),
          F4: P([4]),
          P1: A("cannot establish causation became caused", "polarity", "certainty"),
          F5: P([6]),
        },
      },
      {
        id: "near-misses",
        note: "the survey's setup is described instead of its findings",
        sentences: [
          "The survey covered 2,340 employees across all divisions.",
          "Caregivers made up a substantial share of respondents.",
          "Remote-work frequency and tenure were recorded for every respondent.",
          "Managers were less positive than individual contributors about hybrid work's effect on collaboration.",
          "Because the survey was cross-sectional, it cannot establish whether hybrid work caused these differences.",
          "Response rates varied between divisions.",
        ],
        labels: {
          F1: M("gives the sample size, not the focus result", "near_miss"),
          F2: M("mentions caregivers, not that they improved most", "near_miss"),
          F3: M("mentions remote frequency and tenure, not the finding", "near_miss"),
          F4: P([4]),
          P1: P([5]),
          F5: M("says rates varied, not that manufacturing was low and unrepresentative", "near_miss"),
        },
      },
      {
        id: "two-sentences",
        note: "everything merged into two long sentences",
        sentences: [
          "Hybrid work improved focus for 61% of 2,340 employees (18% said the opposite), most of all among caregivers, while those remote more than three days a week felt more disconnected, an association that weakened after controlling for tenure.",
          "Managers saw less benefit for collaboration than individual contributors, the cross-sectional design cannot establish that hybrid work caused these differences, and manufacturing's 34% response rate (vs. 71% elsewhere) may leave that division unrepresented.",
        ],
        labels: {
          F1: P([1], "merge"),
          F2: P([1], "merge", "strong_paraphrase"),
          F3: P([1], "merge"),
          F4: P([2], "merge", "strong_paraphrase"),
          P1: P([2], "merge"),
          F5: P([2], "merge", "strong_paraphrase"),
        },
      },
    ],
  },
  {
    id: "spec-probes",
    domain: "the spec's §24 probes",
    source: "12 participants completed the experiment. Participants repeatedly moved between sketching and prototyping.",
    units: [
      { id: "F1", kind: "must_cover", text: "12 participants completed the experiment." },
      { id: "F2", kind: "must_cover", text: "Participants repeatedly moved between sketching and prototyping." },
    ],
    rewrites: [
      {
        id: "paraphrase",
        note: "the spec's allowed rewrite",
        sentences: ["The experiment involved 12 participants.", "Their workflow iteratively alternated between sketching and prototyping."],
        labels: { F1: P([1], "strong_paraphrase"), F2: P([2], "strong_paraphrase") },
      },
      {
        id: "drift",
        note: "the spec's rejected rewrite, plus a one-way move",
        sentences: ["10 participants completed the experiment.", "Participants moved from sketching to prototyping."],
        labels: {
          F1: A("12 became 10", "numbers"),
          F2: A("repeated back-and-forth became a single move", "fact"),
        },
      },
      {
        id: "words",
        note: "a number spelled out, and the alternation lost",
        sentences: ["Twelve participants completed the experiment.", "Participants spent time both sketching and prototyping."],
        labels: {
          F1: P([1]),
          F2: A("both activities are named, the repeated alternation is not", "partial", "near_miss"),
        },
      },
    ],
  },
];
