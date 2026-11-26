# Learning curriculum: grown-up reference

What the learning chests teach, which school standard or speech-language goal each part serves, why the questions are
built the way they are, and what grade 1 still holds that the game does not. Written 2026-11-26 for the player: a
6-year-old autistic boy, a strong first-grade reader in Montgomery County Public Schools (Maryland), whose IEP
speech-language goals are irregular past tense, pragmatic language (greetings, expected and unexpected behaviour),
social stories and prediction in reading comprehension.

Maryland teaches the Maryland College and Career Ready Standards (MCCRS). They were adopted from the Common Core State
Standards in 2010 and keep the Common Core codes (MSDE reissued the documents in 2022-23; some county guides write
1.MD.3 for 1.MD.B.3). The codes below are the Common Core ones. A school's report card may group them differently.

## Subjects and what they serve

Subject ids are the game's (`LEARN_SUBJ`). "IEP" marks a subject that serves one of the child's own goals directly.
By default the grown-ups page asks verb, talk and read (the three IEP subjects) three times as often as the rest
(`LEARN_FOCUS`, the ★ beside each subject).

| Subject (skills) | Standard or goal area | Notes |
|---|---|---|
| `verb`: irregular past tense | L.1.1e (past, present, future verbs); L.2.1d (past tense of frequent irregular verbs) | IEP. Irregular forms are formally a grade 2 standard; first grade expects tense in general. |
| `plural`: irregular plurals | L.1.1b, L.1.1c (nouns, matching verbs); L.2.1b (irregular plurals: feet, mice) | Same pattern as verbs: a regular rule plus exceptions. |
| `grammar`: `pronoun` | L.1.1d (personal, possessive, indefinite pronouns) | Pronoun reversal and he/she errors are common SLP targets in autism. |
| `grammar`: `prep` | L.1.1i (frequent prepositions) | in, on, under, behind, next to, between. |
| `grammar`: `bewas` | L.1.1c (subject-verb agreement), L.1.1e (tense) | is/are, was/were. |
| `grammar`: `neg` | SLP goal bank (negation); supports L.1.1j sentences | "Which one is NOT..." also trains careful reading of the question. |
| `talk`: greeting, expected, topic, turns, help, repair, listen, polite, sorry, join, no, compliment, tone, feelings, perspective, idiom | SL.1.1a-c (discussion rules, building on talk, asking to clear up confusion), SL.1.3, SL.1.6; ASHA pragmatic language and social communication | IEP (greetings, expected and unexpected behaviour, pragmatics). `idiom` is grade 2 and taught explicitly. |
| `feel`: `emotion` | RL.1.4 (words that suggest feelings), SL.1.4 (express feelings); SLP emotion inference and theory of mind | Feelings are read from the situation, not from faces; see design choices. |
| `feel`: `size`, `react`, `calm` | Emotion regulation; NCAEP Cognitive Behavioral/Instructional Strategies | Generic "size of the problem" wording, no trademarked programme. |
| `read`: `predict` | RL.1.1, RL.1.3, RL.1.7 (key details, characters, events, pictures) | IEP. Prediction is not a named grade 1 standard; it is a comprehension strategy built on these. |
| `wh`: who, what, where, when, why | RL.1.1, SL.1.2 (ask and answer questions about key details); SLP WH-question goals | Why is the hardest for autistic children; kept to literal cause. |
| `seq`: first, next, last | RL.1.2 (retell with key details), RL.1.3 (major events) | Story retell and sequencing goals. |
| `seq`: `steps` | NCAEP Task Analysis; daily-living routines | Steps of hand washing, getting ready for school. |
| `vocab`: `category` | L.1.5a (sort into categories), L.1.5b (define by category and attribute) | Category naming and membership are standard SLP goals. |
| `vocab`: `odd` | L.1.5a | Which one does not belong. |
| `vocab`: `opposite` | L.K.5b (antonyms), carried in grade 1 | |
| `vocab`: `same` | L.1.5d (shades of meaning, partly); L.2.5 | Synonyms. |
| `vocab`: `multi` (grade 2) | L.1.4, L.2.4 (multiple-meaning words) | bat, ring, bark. |
| `math`: arithmetic | 1.OA.C.6 (within 20, fluent within 10), 1.OA.D.8 (unknown in any position), 1.OA.B.4 (subtraction as missing addend); grade 2: 2.OA.B.2, 2.NBT.B.5 | First grade within 20; second within 100. |
| `math`: ±10 (grade 2 setting) | 1.NBT.C.5 (10 more, 10 less) | |
| `math`: `place` (tens and ones; compare) | 1.NBT.B.2, 1.NBT.B.3; grade 2: 2.NBT.A.1, 2.NBT.A.4 | The standard compares two numbers with <, =, >; the game picks the biggest of three. |
| `math`: `story` (word problems) | 1.OA.A.1 (add to, take from, put together, take apart, compare) | Templates cover add-to and take-from; see gaps. |
| `math`: `time` | 1.MD.B.3 (hours and half hours); grade 2: 2.MD.C.7 (nearest five minutes) | |
| Stories menu (social stories) | NCAEP Social Narratives; IEP | Read, not quizzed or rewarded. |

## Design choices and the evidence behind them

**Short, literal, concrete text; one clearly best answer.** Autistic children understand figurative language less well
than peers (meta-analysis, Hedges' g = -0.57), and wh-questions, especially why, are harder for them. Items keep to
literal wording and literal causes; idioms and sarcasm appear only in grade 2 items that teach them by name. Each item
has one answer that is clearly best, so a correct choice means the skill, not a guess about what the writer meant.

**Low-error learning with kind feedback that points to the clue.** Errorless and low-error teaching is well
established for autistic learners (ASAT); a randomised comparison (Leaf et al., 2020) found both errorless and
error-correction teaching effective and unlikely to cause distress. The game sits between the two: three choices, a
miss shows a tip or a "why" that sends the child back to the words that hold the answer, the missed choice greys out
and the same question stays, so every item ends in a correct answer. Prompting and reinforcement are two of the most
supported NCAEP practices (140 and 106 studies). The `why` text never says "wrong" or "no".

**Distractors are real kid mistakes, not traps.** Grammar distractors are the classic errors (wrong pronoun, regular
-ed on an irregular verb). For feelings and social items the distractors should be clearly worse, not a second
defensible answer: a child who reasons well about people must never be marked off for it.

**Missed items return more often.** Each item sits in a Leitner box; a miss sends it back to box 0 and lower boxes are
drawn more often. Spaced retrieval improves retention and transfer (Kang, 2016); in young children with language
disorders, repeated spaced retrieval raised word recall and held it a week later (Leonard et al., 2021). Direct trials
in autistic children are few, so this rests on the general learning literature.

**Feelings come from situations, not faces.** Autistic children can name basic emotions from situational cues, but
when face and situation disagree they lean on the face (Tell and Davidson, 2014). Reading the situation is the skill
that needs practice, so `feel` items describe what happened and ask how someone might feel. Emotion recognition
training improves the trained skill, but generalisation is weak (Cochrane review, Fletcher-Watson et al., 2014).

**Generalisation to everyday settings.** ASHA names generalisation across settings and partners as a core treatment
aim, and theory-of-mind gains rarely carry over by themselves. About half of the items are set at school, home, the
park or the bus rather than in the game, and the friends who speak are the child's own game companions. A grown-up
who uses the same words at home (the progress table shows which skills are tricky) does more for carry-over than
more chests.

**Social stories are read, not quizzed or rewarded.** Social narratives are an NCAEP evidence-based practice for ages
3-11 in communication, social and behaviour outcomes; Social Stories (Carol Gray) are the named manualised form. They
are first person, mostly descriptive (Gray's criteria require descriptive sentences to outnumber coaching sentences
several times over) and individualised. A story is meant to inform, so the game never scores it. Two findings matter
for grown-ups: stories read just before the real situation, and stories about one behaviour, work better; and studies
that checked comprehension had better results (Kokina and Kern, 2010). Read a story with him shortly before the event
it describes and talk about it afterwards; that talk is the comprehension check, kept outside the game.

**No punishment and no shame.** A miss costs only a short wait. Smash always opens a chest. Characters make mistakes
and fix them. Expected and unexpected behaviour is taught as information about what others expect, not as a judgment
of the child; items avoid targets that the neurodiversity-affirming SLP literature warns against (forced eye contact,
stopping stimming, hiding feelings for others' comfort).

**Focus on the IEP.** With ten subjects on, the child's goals could be diluted. The grown-ups page weights chosen
subjects three times (verb and talk by default). Prediction (`read`) is also an IEP goal; consider adding it to the
focus, and turning off subjects the school already covers well.

## Added after the first review

The first four gaps below were filled on 2026-11-26: `tense` items in the verb subject (time words, regular -ed,
-ied and doubled consonants, against over-regularised forms; L.1.1e), `think` items in the read subject (what a
character wants, false belief and who knows what, who is telling the story, two characters thinking differently;
RL.1.3, RL.1.6), `cause` items in grammar (because, so, but; L.1.1g, L.1.6) and more `repair` items in talk (asking
to clear up confusion; SL.1.1c, SL.1.3). Tense and think sit in starred (Focus) subjects, beside the IEP goals they
extend. The list is kept as written for reference.

## Grade 1 targets not yet covered, by value for this child

1. **Tense contrast and regular -ed** (L.1.1e: "Yesterday I walked; today I walk; tomorrow I will walk"). Extends the
   IEP verb goal: choosing the tense from a time word, and catching over-regularised forms ("goed").
2. **Characters' thoughts and point of view in a story** (RL.1.3, RL.1.6 who is telling the story, RL.1.9 compare
   characters). Links prediction, feelings and perspective: what does Hale think is in the box, when Nim moved it?
3. **Because and so** (L.1.1g conjunctions, L.1.6 "because" for simple relationships). Causal language underlies why
   answers, explaining feelings and expected behaviour.
4. **Asking to clear up confusion** (SL.1.1c, SL.1.3). The `repair` items are few; a set where the right move is to
   ask a question ("What do you mean?") fits the pragmatic goals.
5. **Informational text** (RI.1.1-RI.1.7: key details, main topic, text features). Short fossil and animal facts tied
   to the museum would use his interest.
6. **Shades of meaning** (L.1.5d: look, peek, stare; big, gigantic). Also useful for feeling intensity (annoyed, mad,
   furious) alongside size of the problem.
7. **Word-problem types beyond add-to and take-from** (1.OA.A.1 compare and unknown-start problems; 1.OA.A.2 three
   addends to 20).
8. **The equal sign** (1.OA.D.7: is 7 = 8 - 1 true or false?).
9. **Data** (1.MD.C.4: read a tally or picture chart with up to three categories; the bag and museum supply data).
10. **Length** (1.MD.A.1-2: order three objects, measure in units).
11. **Shapes and halves and fourths** (1.G.A.1-3).
12. **Counting to 120 and possessive and indefinite pronouns** (1.NBT.A.1; L.1.1b, L.1.1d: anyone, everything).
    Phonics (RF.1) is left out on purpose: he reads well.

## Sources

- Common Core, grade 1 Language: https://www.thecorestandards.org/ELA-Literacy/L/1/
- Common Core, grade 1 Reading Literature: https://www.thecorestandards.org/ELA-Literacy/RL/1/
- Common Core, grade 1 Speaking and Listening: https://www.thecorestandards.org/ELA-Literacy/SL/1/
- Common Core, grade 1 Operations and Algebraic Thinking: https://www.thecorestandards.org/Math/Content/1/OA/
- Common Core, grade 1 Number and Operations in Base Ten: https://www.thecorestandards.org/Math/Content/1/NBT/
- Common Core, grade 1 Measurement and Data: https://www.thecorestandards.org/Math/Content/1/MD/
- MSDE, Maryland College and Career Ready Standards for ELA: https://marylandpublicschools.org/programs/Pages/ELA/standards.aspx
- MSDE, MCCRS Mathematics grade 1 framework: https://www.marylandpublicschools.org/about/Documents/DCAA/Math/MCCRSM/MCCRSMGrade1.pdf
- Howard County grade 1 mathematics curriculum (1.MD.3 coding): https://www.hcpss.org/f/academics/math/math-grade-one-curriculum.pdf
- ASHA Practice Portal, Autism: https://www.asha.org/practice-portal/clinical-topics/autism/
- ASHA, Autism spectrum disorder (payer portal, treatment aims): https://www.asha.org/practice/payer-portal/autism-spectrum-disorder
- Steinbrenner et al. (2020), NCAEP Evidence-Based Practices report: https://ncaep.fpg.unc.edu/wp-content/uploads/EBP-Report-2020.pdf
- Carol Gray, Social Stories 10.4 criteria: https://carolgraysocialstories.com/wp-content/uploads/2023/11/2023-Social-Stories-10.4-Criteria.pdf
- Kokina and Kern (2010), Social Story interventions meta-analysis (ASHA Evidence Maps summary): https://apps.asha.org/EvidenceMaps/Articles/ArticleSummary/b8a776ce-b372-40f9-8f48-7659cbe61c75
- Fletcher-Watson et al. (2014), Cochrane review of theory-of-mind interventions: https://www.cochrane.org/evidence/CD008785_review-evidence-use-interventions-people-autism-spectrum-disorder-based-psychological-model-theory
- Tell and Davidson (2014), emotion from facial and situational cues: https://pubmed.ncbi.nlm.nih.gov/24852752
- Kalandadze et al. (2016), figurative language in autism meta-analysis: https://journals.sagepub.com/doi/10.1177/1362361316668652
- Figurative language intervention scoping review (2025): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12649625/
- Wh-question comprehension in autism: https://pmc.ncbi.nlm.nih.gov/articles/PMC5344911 and https://imfar.confex.com/imfar/2015/webprogram/Paper19657.html
- ASAT, errorless learning: https://asatonline.org/for-parents/learn-more-about-specific-treatments/applied-behavior-analysis-aba/aba-techniques/errorless-learningteaching/
- Leaf et al. (2020), error correction versus errorless learning RCT: https://pmc.ncbi.nlm.nih.gov/articles/PMC7343685
- Kang (2016), spaced repetition: https://findanexpert.unimelb.edu.au/scholarlywork/1402004-spaced-repetition-promotes-efficient-and-effective-learning--policy-implications-for-instruction
- Leonard et al. (2021), repeated spaced retrieval and word learning: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8126157/
- Aspect, neurodiversity-affirming goal setting: https://aspect.org.au/uploads/documents/Research/Aspect-approach/Neurodiversity-affirming-goal-setting.pdf
