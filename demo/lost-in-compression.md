# Synthetic research example

This is fictional demo material. All study names, participants, measurements and results below are invented for testing text preservation; they are not research evidence.

## 4.1 Compression and fluency

We collected 1,440 rewrites in total: 12 AI editing tools each shortened 40 research abstracts and 80 results sections to roughly 30% of their original length, following the protocol described in Section 3.2. Before examining what the rewrites lost, we first checked whether the tools had done what they were asked. By and large they had: the median rewrite reached 31% of the original word count, and 83% of rewrites landed within ten percentage points of the requested length. It is worth noting at this point that length compliance varied considerably between tools, from 97% for the most compliant tool to 58% for the least compliant, but because this variation was unrelated to any of the outcomes discussed below, we report pooled values throughout this section.

Fluency was not the problem. Three expert raters scored every rewrite for readability on a 7-point scale, and the shortened versions were rated as more readable than the originals (median 5.8 vs. 4.9; Wilcoxon signed-rank, p < .001), with good agreement between raters (Krippendorff's α = .78). In other words, by the measures that editors usually look at, the rewrites were a success.

## 4.2 What was lost

To measure information loss, two annotators listed the key findings of every source text (median 7 per text) and then checked each rewrite for each finding, resolving disagreements by discussion. Across all rewrites, 21% of key findings were missing, and a further 9% were present but altered in meaning. The losses were not random. Findings stated in the second half of a source text were dropped almost twice as often as findings stated in the first half (27% vs. 14%), and findings that depended on a number, a hedge or a condition were the most vulnerable: numbers were changed or dropped in 18% of the findings that contained them, and hedged claims such as "may reduce" lost their hedge in 12% of cases.

The most fluent version was not necessarily the one that kept the most findings. Readability ratings and the proportion of findings retained were essentially uncorrelated (Spearman's ρ = .04), which means that a reader who judges a rewrite by how well it reads receives no signal at all about what it left out.

This pattern appeared to extend beyond the source texts we selected, which is something that, given the way the corpus was assembled and the fact that it was drawn entirely from computer science and psychology venues, has to be read with some care: when we repeated the analysis on a smaller set of 20 clinical abstracts collected after the main study, the proportion of missing findings was similar (19%), but because this set was small, was annotated by only one of the two annotators, and was added after the main analysis, we treat it as a preliminary indication rather than as evidence that the effect generalizes across fields.

## 4.3 Do readers notice?

In the reader study, 36 participants each read six rewrites without access to the source, and were then shown the source's key findings and asked which of them the rewrite had contained. Participants were confident in their answers (median confidence 6 on a 7-point scale), yet they correctly identified only 41% of the missing findings; the remaining 59% were either marked as present or left unmarked. When the source was shown side by side with the rewrite, detection rose to 77%, but the task took roughly three times as long (median 9.4 vs. 3.1 minutes per rewrite).

Several participants remarked that the shortened versions felt complete precisely because they read so smoothly, and two said they would have signed off on a rewrite that, as they learned afterwards, had dropped the paper's main limitation. This observation was not something we had anticipated when designing the study, and it came up in both of the study's sessions.

## 4.4 Does asking help?

Finally, we tested whether simply telling the tools not to lose information changed the outcome. Adding the instruction "do not remove any findings" to the prompt reduced the share of missing findings from 21% to 16%, but it also made the rewrites longer (median 44% of the original length instead of 31%), and the reduction came almost entirely from the shorter source texts; for results sections longer than 800 words, the instruction made no detectable difference (p = .47).

Giving the tools an explicit list of the findings to keep was more effective: missing findings fell to 6%, and length compliance was unaffected. However, someone had to write that list, which took participants a median of 7 minutes per source text, and even with the list in the prompt, 4% of findings were changed in meaning rather than dropped, typically through a lost hedge or a strengthened causal claim. Taken together, these results suggest that the most reliable safeguard is not a better instruction but a check that runs after the rewrite and compares it against the findings that were supposed to survive.
