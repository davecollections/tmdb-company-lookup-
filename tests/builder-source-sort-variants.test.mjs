import assert from "node:assert/strict";
import test from "node:test";
import { createBuilderController } from "../builder/src/application/index.js";
import { discoverSourceIdentity } from "../builder/src/nuvio/discover.js";
import {
	applyDecadesHierarchyPlan, applyGenreHierarchyPlan, applyStreamingHierarchyPlan,
	buildDecadeSourceBundleDrafts, buildDecadesSourceDrafts, buildGenreSourceDrafts, buildStreamingSourceDrafts,
	createDecadeSourceBundle, createGenreSourceBundle, createStreamingSourceBundle,
	createDecadesHierarchyPlan, createGenreHierarchyPlan, createStreamingHierarchyPlan,
	decadeDuplicateOverrideIdentity, genreDuplicateOverrideIdentity, streamingDuplicateOverrideIdentity,
	DECADE_PRESETS, completeOfficialGenreNames, inspectStreamingHierarchyDestinationCandidates,
} from "../builder/src/source-add/index.js";
import { buildDecadesPreviewGroups, resolveDecadesPreviewRequest } from "../builder/src/source-add/decades-preview.js";
import { orderedSourceSortIds, sourceDraftSortId } from "../builder/src/source-add/source-sort-variants.js";
import { reconcileStreamingSortTitleDrafts } from "../builder/src/source-add/streaming-source.js";
import { resolveSourcePreviewDraft, sourcePreviewVariantGroups, sourcePreviewVariantKey } from "../builder/src/source-add/source-title-preview.js";

const sorts = ["top-rated", "recent"];
const provider = (id = 2, name = "Apple TV") => ({ id, name, moviePriorities: { AU: 1, US: 2 }, tvPriorities: { AU: 1, US: 2 } });
const regions = [{ code: "AU", name: "Australia" }, { code: "US", name: "United States" }];
const controller = () => createBuilderController();
const source = (extra = {}) => ({ selectedDecadeIds: ["1980s", "1990s"], mediaMode: "both", content: { wholeDecade: true, individualYears: true, genreBreakdown: true }, currentYear: 2026, genreNames: ["Comedy", "Drama"], sortOptionIds: sorts, ...extra });
const key = (draft) => discoverSourceIdentity(draft.editable).key;
const planOptions = (app, extra) => ({ scope: "new-collection", projectRevision: app.getState().revision, ...extra });
function destination(app) {
	const collectionId = app.createCollection({ editable: { title: "Destination" } }).createdInternalId;
	const folderId = app.createFolder(collectionId, { editable: { title: "Existing" } }).createdInternalId;
	app.selectNode(folderId);
	return { collectionId, folderId };
}

test("creation sort selection is ordered, explicit, scalar-compatible and rejects invalid or empty sets", () => {
	assert.deepEqual(orderedSourceSortIds(sorts), ["recent", "top-rated"]);
	for (const invalid of [[], ["recent", "recent"], ["unknown"], null, "recent", [undefined]]) assert.equal(orderedSourceSortIds(invalid), null);
	const constructors = [
		(options) => buildStreamingSourceDrafts(provider(), { regionCodes: ["AU"], mediaChoice: "both", ...options }),
		(options) => buildGenreSourceDrafts(["Comedy"], options),
		(options) => buildDecadeSourceBundleDrafts({ periodIds: ["year-1980"], ...options }),
		(options) => buildDecadesSourceDrafts(source({ sortOptionIds: undefined, ...options })),
	];
	for (const build of constructors) {
		for (const sortOptionId of ["popular", "recent", "top-rated", "most-votes"]) {
			const scalar = build({ sortOptionId });
			assert.equal(scalar.ok, true, JSON.stringify(scalar.errors));
			assert.deepEqual(build({ sortOptionIds: [sortOptionId] }).drafts, scalar.drafts);
		}
		const empty = build({ sortOptionIds: [] });
		assert.equal(empty.ok, false);
		assert.equal(empty.drafts.length, 0);
		assert.ok(empty.errors.some((error) => error.message === "Choose at least one option."));
	}
});

test("Streaming keeps provider/region grouping, displayed sort order and correct media mappings", () => {
	const drafts = buildStreamingSourceDrafts(provider(), { regionCodes: ["AU"], mediaChoice: "both", sortOptionIds: sorts, nameContext: "separate-by-region" }).drafts;
	assert.deepEqual(drafts.map((draft) => draft.editable.title), ["Recent Movies", "Recent Series", "Top rated Movies", "Top rated Series"]);
	assert.deepEqual(drafts.map((draft) => draft.editable.sortBy), ["primary_release_date.desc", "first_air_date.desc", "vote_average.desc", "vote_average.desc"]);
	assert.ok(drafts.every((draft) => Object.keys(draft.editable.filters).length === 2));
	for (const [groupingMode, folderCount] of [["group-by-service", 2], ["separate-by-region", 4]]) {
		const app = controller();
		const result = createStreamingHierarchyPlan(app.getState().project, planOptions(app, { providers: [provider(), provider(8, "Netflix")], regions, mediaChoice: "both", sortOptionIds: sorts, groupingMode }));
		assert.equal(result.ok, true, JSON.stringify(result.errors));
		assert.equal(result.plan.counts.sourceCount, 16);
		assert.equal(result.plan.counts.folderCount, folderCount);
		assert.equal(applyStreamingHierarchyPlan(app, result.plan).ok, true);
		assert.equal(applyStreamingHierarchyPlan(app, result.plan).ok, false);
	}
});

test("Streaming titles are exact and sort-specific across dormant variants", () => {
	const options = { regionCodes: ["AU"], mediaChoice: "both", sortOptionIds: sorts, sourceTitles: { "AU|MOVIE|recent": "  My imported — name  ", "AU|MOVIE|top-rated": "Rating favourites" } };
	const built = buildStreamingSourceDrafts(provider(), options);
	assert.equal(built.ok, true);
	assert.equal(built.drafts[0].editable.title, "  My imported — name  ");
	assert.equal(built.drafts[2].editable.title, "Rating favourites");
	assert.equal(buildStreamingSourceDrafts(provider(), { ...options, sortOptionIds: ["top-rated"] }).drafts[0].editable.title, "Rating favourites");
	assert.equal(buildStreamingSourceDrafts(provider(), { ...options, sortOptionIds: ["recent"] }).drafts[0].editable.title, "  My imported — name  ");
});

test("sole Streaming sort replacements preserve names without cross-assigning multi-sort overrides", () => {
	const original = { "2|AU|MOVIE|popular": "  My — name  ", "8|AU|MOVIE|popular": "Other provider" };
	const replaced = reconcileStreamingSortTitleDrafts(original, 2, ["popular"], ["recent"]);
	assert.equal(replaced["2|AU|MOVIE|recent"], original["2|AU|MOVIE|popular"]);
	assert.equal(replaced["8|AU|MOVIE|recent"], undefined);
	assert.deepEqual(reconcileStreamingSortTitleDrafts(original, 2, ["popular"], ["popular", "recent"]), original);
	assert.deepEqual(reconcileStreamingSortTitleDrafts(original, 2, ["popular", "recent"], ["recent"]), original);
	const distinct = { ...original, "2|AU|MOVIE|recent": "Recent only" };
	assert.deepEqual(reconcileStreamingSortTitleDrafts(distinct, 2, ["popular"], ["recent"]), distinct);
});

test("unknown Streaming sorting remains guarded in a provider/region folder", () => {
	const app = controller(); const { collectionId, folderId } = destination(app);
	const draft = buildStreamingSourceDrafts(provider(), { regionCodes: ["AU"], mediaChoice: "movies" }).drafts[0];
	assert.equal(app.createSource(folderId, { ...draft, editable: { ...draft.editable, sortBy: "revenue.desc" } }).ok, true);
	const before = app.getState();
	const built = createStreamingHierarchyPlan(before.project, { scope: "new-folder", destinationCollectionInternalId: collectionId, projectRevision: before.revision, providers: [provider()], regions: [regions[0]], mediaChoice: "movies", sortOptionIds: sorts });
	assert.equal(built.ok, true);
	assert.ok(built.plan.conflicts.length > 0);
	assert.equal(applyStreamingHierarchyPlan(app, built.plan).ok, false);
	assert.equal(app.getState().project, before.project);
	assert.equal(app.getState().revision, before.revision);
});

test("Genre structures and composite placements expand sources without multiplying folders", () => {
	for (const structure of ["genre-folders", "media-folders", "separate-media-genre-folders", "separate-media-collections"]) {
		const app = controller();
		const options = planOptions(app, { genres: ["Comedy", "Drama"], sharedMediaChoice: "both", structure });
		const single = createGenreHierarchyPlan(app.getState().project, options);
		const multi = createGenreHierarchyPlan(app.getState().project, { ...options, sortOptionIds: sorts });
		assert.equal(multi.ok, true, JSON.stringify(multi.errors));
		assert.equal(multi.plan.counts.folderCount, single.plan.counts.folderCount);
		assert.equal(multi.plan.counts.collectionCount, single.plan.counts.collectionCount);
		assert.equal(multi.plan.counts.sourceCount, single.plan.counts.sourceCount * 2);
		for (const folder of multi.plan.collections.flatMap((collection) => collection.folders)) {
			assert.equal(new Set(folder.sources.map((entry) => key(entry.draft))).size, folder.sources.length);
			assert.ok(folder.sources.every((entry) => / - (Recent|Top rated)$/.test(entry.draft.editable.title)));
		}
		assert.equal(applyGenreHierarchyPlan(app, multi.plan).ok, true);
	}
	const app = controller();
	const result = createGenreHierarchyPlan(app.getState().project, planOptions(app, { genres: ["Action", "Adventure", "Action & Adventure"], sortOptionIds: sorts, compositePlacements: { "Action & Adventure": "both" } }));
	assert.equal(result.plan.counts.folderCount, 2);
	assert.equal(result.plan.counts.sourceCount, 8);
	for (const folder of result.plan.collections[0].folders) assert.equal(folder.sources.filter((entry) => entry.mediaType === "TV").length, 2);
});

test("Decades keeps additive guided composition and ordinary period × Genre expansion", () => {
	const app = controller();
	for (const sourceGrouping of ["movies-first", "paired"]) {
		const result = createDecadesHierarchyPlan(app.getState().project, planOptions(app, { layout: "mixed-collection", source: source({ sourceGrouping }) }));
		assert.equal(result.ok, true, JSON.stringify(result.errors));
		assert.equal(result.plan.counts.sourceCount, 104);
		assert.equal(result.plan.counts.folderCount, 2);
		const entries = result.plan.collections[0].folders.flatMap((folder) => folder.sources);
		assert.equal(entries.filter((entry) => entry.contentKind === "genre-breakdown").length, 16);
		assert.ok(entries.every((entry) => !entry.draft.editable.title.includes("All ") && !entry.draft.editable.title.includes("—")));
		if (sourceGrouping === "paired") assert.deepEqual(entries.slice(0,4).map((entry) => entry.draft.editable.title), ["1980s Movies - Recent", "1980s Series - Recent", "1980s Movies - Top rated", "1980s Series - Top rated"]);
	}
	const built = buildDecadeSourceBundleDrafts({ periodIds: ["year-1982", "year-1980", "year-1981"], genreNames: ["Comedy", "Drama"], mediaMode: "both", sortOptionIds: sorts });
	assert.equal(built.drafts.length, 36);
	assert.deepEqual(built.periodGroups.map((group) => group.period.label), ["1980", "1981", "1982"]);
	assert.equal(new Set(built.drafts.map(key)).size, 36);
});

test("ordinary Add validates all variants, skips exact matches and binds explicit approval to complete candidates", () => {
	const cases = [
		{ build: (o) => buildGenreSourceDrafts(["Comedy"], o), create: createGenreSourceBundle, override: genreDuplicateOverrideIdentity, options: { genres: ["Comedy"] } },
		{ build: (o) => buildDecadeSourceBundleDrafts(o), create: createDecadeSourceBundle, override: decadeDuplicateOverrideIdentity, options: { periodIds: ["year-1980"] } },
		{ build: (o) => buildStreamingSourceDrafts(provider(), o), create: createStreamingSourceBundle, override: streamingDuplicateOverrideIdentity, options: { provider: provider(), regions, catalogueRegions: regions, regionCodes: ["AU", "US"], mediaChoice: "both" } },
	];
	for (const item of cases) {
		const app = controller();
		const { folderId } = destination(app);
		const options = { ...item.options, sortOptionIds: sorts, folderInternalId: folderId };
		const { drafts } = item.build(options);
		assert.ok(drafts.length > 0);
		app.createSource(folderId, drafts[0]);
		const revision = app.getState().revision;
		const added = item.create(app, { ...options, drafts, duplicateOverrideIdentity: item.override(folderId, drafts.slice(0,1)) });
		assert.equal(added.ok, true, JSON.stringify(added.errors));
		assert.equal(added.addedSourceCount, drafts.length - 1);
		assert.equal(app.getState().revision, revision + 1);
		assert.equal(item.create(app, { ...options, drafts }).ok, false);
		assert.equal(item.create(app, { ...options, drafts, duplicateOverrideIdentity: item.override(folderId, drafts) }).ok, true);
	}
});

test("trusted Streaming folders accept missing supported variants and preserve existing nodes", () => {
	const app = controller();
	const { collectionId, folderId } = destination(app);
	const old = buildStreamingSourceDrafts(provider(), { regionCodes: ["AU"], mediaChoice: "both", sortOptionId: "recent" });
	for (const draft of old.drafts) app.createSource(folderId, draft);
	const before = structuredClone(app.getState().project.collections[0].folders[0]);
	const options = planOptions(app, { providers: [provider()], regions: [regions[0]], mediaChoice: "both", sortOptionIds: sorts });
	const candidates = inspectStreamingHierarchyDestinationCandidates(app.getState().project, options);
	assert.equal(candidates.ok, true);
	const plan = candidates.candidates.find((entry) => entry.collectionInternalId === collectionId).plan;
	assert.equal(plan.counts.exactSourceCount, 2);
	assert.equal(plan.counts.newSourceCount, 2);
	assert.equal(plan.counts.newFolderCount, 0);
	assert.equal(plan.conflicts.length, 0);
	assert.equal(applyStreamingHierarchyPlan(app, plan).ok, true);
	const after = app.getState().project.collections[0].folders[0];
	assert.deepEqual(after.editable, before.editable);
	assert.deepEqual(after.sources.slice(0,2), before.sources);
});

test("Preview resolves unique media and sort controls by query, retains valid dimensions and never changes drafts", () => {
	const built = buildDecadeSourceBundleDrafts({ periodIds: ["year-1980", "year-1981"], genreNames: ["Comedy"], sortOptionIds: sorts });
	const before = JSON.stringify(built);
	const first = built.logicalSources[0];
	const active = resolveSourcePreviewDraft(first.drafts, { mediaType: "TV", sortOptionId: "top-rated" });
	const groups = sourcePreviewVariantGroups(first.drafts, active, () => {});
	assert.deepEqual(groups.map((group) => group.options.map((option) => option.id)), [["MOVIE", "TV"], ["recent", "top-rated"]]);
	assert.equal(groups[1].label, "Show");
	assert.equal(groups[1].ariaLabel, "Preview show");
	const next = resolveSourcePreviewDraft(built.logicalSources.at(-1).drafts, { mediaType: active.editable.mediaType, sortOptionId: sourceDraftSortId(active) });
	assert.equal(next.editable.mediaType, "TV");
	assert.equal(sourceDraftSortId(next), "top-rated");
	assert.notEqual(sourcePreviewVariantKey(next), sourcePreviewVariantKey(active));
	assert.equal(JSON.stringify(built), before);
});

test("guided samples stay distinct, lazy request descriptors with at most ten buckets per active variant", () => {
	const built = buildDecadesPreviewGroups(source());
	assert.equal(built.ok, true);
	for (const group of built.groups) {
		assert.equal(group.logicalSourceCount, 13);
		const sample = group.choices[0];
		assert.equal(sample.kind, "representative-sample");
		assert.equal(sample.requests.length, 4);
		for (const request of sample.requests) {
			assert.ok(request.drafts.length <= 10);
			assert.ok(request.drafts.every((draft) => sourceDraftSortId(draft) === request.sortOptionId && draft.editable.mediaType === request.mediaType));
		}
		const active = resolveDecadesPreviewRequest(sample, { mediaType: "TV", sortOptionId: "top-rated" });
		const year = group.choices.find((choice) => choice.period?.kind === "year");
		const exact = resolveDecadesPreviewRequest(year, active);
		assert.equal(exact.sortOptionId, active.sortOptionId);
		assert.equal(exact.mediaType, active.mediaType);
		assert.ok(exact.draft && !exact.drafts);
	}
});

test("expanded Decades planning and atomic insertion size is derived from actual fixture", (t) => {
	const app = controller();
	const input = source({ selectedDecadeIds: DECADE_PRESETS.map((preset) => preset.id), genreNames: completeOfficialGenreNames(), currentYear: new Date().getFullYear(), currentYearMode: "full-decade", sortOptionIds: ["popular", "recent", "top-rated", "most-votes"] });
	const expected = buildDecadesSourceDrafts({ ...input, sortOptionIds: ["popular"] }).drafts.length * input.sortOptionIds.length;
	const start = performance.now();
	const built = createDecadesHierarchyPlan(app.getState().project, planOptions(app, { source: input }));
	const planned = performance.now();
	assert.equal(built.ok, true, JSON.stringify(built.errors));
	assert.equal(built.plan.counts.sourceCount, expected);
	const revision = app.getState().revision;
	assert.equal(applyDecadesHierarchyPlan(app, built.plan).ok, true);
	const applied = performance.now();
	assert.equal(app.getState().revision, revision + 1);
	assert.equal(app.getState().project.collections.flatMap((collection) => collection.folders).flatMap((folder) => folder.sources).length, expected);
	t.diagnostic(JSON.stringify({ sources: expected, planningMs: +(planned-start).toFixed(2), insertionMs: +(applied-planned).toFixed(2) }));
});
