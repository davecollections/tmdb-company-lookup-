# People Most voted and owner-review evidence

Issue [#200](https://github.com/davecollections/tmdb-id-lookup/issues/200). The small [import example](./people-most-voted.json) contains one Tom Hanks folder (TMDB person 31), with Popular and Most voted siblings for Acting Movies, Acting Series, Directed Movies and Directed Series. All eight Sources remain native `PERSON` or `DIRECTOR`, with scalar `popularity.desc` or `vote_count.desc`. This sanitized example contains no private collection data.

## Supplied client observations, 2026-09-09

The personal export attachments were unavailable in this environment. These are Dave's supplied comparisons, not an independent inspection of those files:

- Website import/export changed all four Most voted values: Movie `vote_count.desc` to `popularity.desc`, TV `vote_count.desc` to `first_air_date.desc`, while titles still said Most voted.
- The synced TV copy followed that website import, so it is not independent evidence that TV converts those values.
- Direct TV import/export through Manage from phone preserved all eight original sorts and added null compatibility fields.
- Desktop export preserved all eight sorts.
- A manually created website PERSON/MOVIE Top rated Source exported `vote_average.desc`.
- Dave reports Popular, Top rated and Recent in the website's People selector, with Most voted also available in the other tested apps.

The [native-variant contract](../../docs/v2/BUILDER_NATIVE_VARIANTS.md) records the import/export route distinctions. Dingo keeps Most voted and preserves `vote_count.desc`. The website rewriting stage remains unknown; JSON preservation alone does not prove displayed ranking. Client versions and detailed title-list/playback evidence were not supplied. No full personal exports or screenshots are stored here, and no upstream report has been posted.

## Current Source-level checks

131 focused domain/UI tests passed. The controlled 50-person plan retains all selections when resolving one ambiguous entry and applies exactly 70 new Sources atomically. Ten live production Worker/TMDB/image-CDN browser cases covered People, Studios and Networks on desktop, short phones and widths 360, 384, 393, 402 and 412. They verified append-only and mixed application, exact Sources split between folders, inline targets, preserved original content, per-person/sort/destination/Appearance drafts across Back, Preview cache reuse and scalar editing. The actual Workspace append path restores visible folder focus and announces the Source count. Phone captures were inspected; fully present choices are grey with text, and Appearance labels fit their cards.

The earlier Warner Bros. Pictures Company 174 investigation remains recorded in the [native contract](../../docs/v2/BUILDER_NATIVE_VARIANTS.md). Top rated sent the correct query and reflected one-vote ratings in the real response; this pass did not change or repeat that diagnosis. Earlier 348-test/20-case and 122-test/seven-case results are historical, not verification of the corrected folder behavior. Owner review of the revised flow and notice treatment was approved on 2026-09-10. Publication validation is recorded in the [native-variant contract](../../docs/v2/BUILDER_NATIVE_VARIANTS.md): the full entry point ran once, narrow corrections passed their affected stages, all required stages completed, and the final production build passed. Historical checks above are not newly executed totals.

## Informal owner walkthrough

Import the small example above, then open New Folder → People and select Tom Hanks plus another person. Popular and Most voted already exist for Tom; Recent or Top rated should become additions to his existing folder while the other person gets a new folder. Preview can still inspect already-present choices.

If Sources for one entity are split across two folders, Configure asks **Add new sources to** only while missing Sources need a target. Choose a folder, go Back and return; the batch and valid choice should remain. Exact Sources already present elsewhere in the Collection stay in place.

Try a single existing person, Studio or Network with a missing sort. **Add sources** finishes directly from Configure. A mixed/new selection continues to Appearance, which affects only new folders. Fully present selections explain that there are no new Sources to add. Feedback can be ordinary observations; no test sheet is needed.
