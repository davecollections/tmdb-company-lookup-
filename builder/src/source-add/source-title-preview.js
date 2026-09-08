import { buildPeopleTitlePreview, PEOPLE_SOURCE_COMBINATIONS, peopleSortOptionId } from "./person-source.js";
import { DISCOVER_SORT_OPTIONS, discoverSourceIdentity } from "../nuvio/discover.js";
import { sourceDraftSortId, sourceSortLabel } from "./source-sort-variants.js";

export function sourcePreviewVariantKey(draft) {
	return discoverSourceIdentity(draft?.editable).key;
}

export function resolveSourcePreviewDraft(drafts, { mediaType, sortOptionId } = {}) {
	const sort = drafts.some((draft) => sourceDraftSortId(draft) === sortOptionId) ? sortOptionId : sourceDraftSortId(drafts[0]);
	const variants = drafts.filter((draft) => sourceDraftSortId(draft) === sort);
	return variants.find((draft) => draft.editable.mediaType === mediaType) ?? variants[0] ?? null;
}

export function sourcePreviewContext(draft) {
	return `${sourceSortLabel(sourceDraftSortId(draft))} ${draft?.editable?.mediaType === "TV" ? "Series" : "Movies"}`;
}

export function sourcePreviewVariantGroups(drafts, activeDraft, onSelect) {
	const activeSort = sourceDraftSortId(activeDraft);
	const activeMedia = activeDraft?.editable?.mediaType;
	const sorts = DISCOVER_SORT_OPTIONS.filter((option) => drafts.some((draft) => sourceDraftSortId(draft) === option.id));
	const media = ["MOVIE", "TV"].filter((mediaType) => drafts.some((draft) => draft.editable.mediaType === mediaType));
	return [
		...(media.length > 1 ? [{ id: "media", label: "Media", ariaLabel: "Preview media", options: media.map((mediaType) => ({
			id: mediaType, label: mediaType === "TV" ? "Series" : "Movies", selected: activeMedia === mediaType,
			onSelect: () => onSelect(resolveSourcePreviewDraft(drafts, { mediaType, sortOptionId: activeSort })),
		})) }] : []),
		...(sorts.length > 1 ? [{ id: "sort", label: "Show", ariaLabel: "Preview show", options: sorts.map((option) => ({
			id: option.id, label: option.label, selected: activeSort === option.id,
			onSelect: () => onSelect(resolveSourcePreviewDraft(drafts, { mediaType: activeMedia, sortOptionId: option.id })),
		})) }] : []),
	];
}

function failure(message) {
	return Object.freeze({
		ok: false,
		error: Object.freeze({
			kind: "invalid-request",
			message,
			retryable: false,
		}),
	});
}

export function listSourceTitlePreviewSummary(data) {
	const loadedCount = Array.isArray(data?.results) ? data.results.length : 0;
	if (loadedCount === 0) return null;
	const totalCount = Number.isSafeInteger(data?.totalResults) && data.totalResults >= loadedCount
		? data.totalResults
		: null;
	const titleLabel = loadedCount === 1 ? "title" : "titles";
	if (totalCount === loadedCount) return `Showing all ${loadedCount} ${titleLabel}`;
	if (totalCount !== null) return `Showing ${loadedCount} of ${totalCount} titles`;
	return `Showing ${loadedCount} ${titleLabel}`;
}

export function sourceTitlePreviewRequest(kind, sourceDraft) {
	const editable = sourceDraft?.editable;
	if (editable === null || typeof editable !== "object") return null;
	const common = {
		kind,
		mediaType: editable.mediaType,
		label: editable.title,
	};
	if (kind === "collection") return Object.freeze({ ...common, tmdbId: editable.tmdbId });
	if (kind === "list") return Object.freeze({ ...common, tmdbId: editable.tmdbId });
	if (kind === "people") {
		const combination = PEOPLE_SOURCE_COMBINATIONS.find((entry) => (
			entry.tmdbSourceType === editable.tmdbSourceType
			&& entry.mediaType === editable.mediaType
		));
		const sortOptionId = peopleSortOptionId(editable.sortBy, editable.mediaType);
		return combination && sortOptionId
			? Object.freeze({ ...common, tmdbId: editable.tmdbId, combinationId: combination.id, sortOptionId })
			: null;
	}
	if (kind === "studio" || kind === "network") {
		return Object.freeze({ ...common, tmdbId: editable.tmdbId, sortBy: editable.sortBy });
	}
	if (kind === "streaming") {
		return Object.freeze({
			...common,
			sourceNode: Object.freeze({
				nodeType: "source",
				internalId: "detached-add-source-preview",
				category: sourceDraft.category,
				editable,
			}),
		});
	}
	if (kind === "genre" || kind === "decade") {
		return Object.freeze({ ...common, sourceDraft });
	}
	return null;
}

export function sourceTitlePreviewProviderAvailable(request, providers) {
	if (!request) return false;
	if (request.kind === "collection") return typeof providers.collection?.getCollection === "function";
	if (request.kind === "list") return typeof providers.list?.getList === "function";
	if (request.kind === "people") return typeof providers.people?.getPerson === "function";
	if (request.kind === "studio") return typeof providers.studio?.getStudioPreview === "function";
	if (request.kind === "network") return typeof providers.network?.getNetworkPreview === "function";
	if (request.kind === "streaming") return typeof providers.streaming?.getStreamingPreview === "function";
	if (request.kind === "genre") return typeof providers.genre?.getGenrePreview === "function";
	if (request.kind === "decade") return typeof providers.decade?.getDecadePreview === "function";
	return false;
}

export async function requestSourceTitlePreview(request, providers, signal) {
	if (request.kind === "list") {
		const result = await providers.list.getList(request.tmdbId, { signal });
		if (!result?.ok) return result;
		return Object.freeze({ ok: true, data: Object.freeze({ results: Object.freeze([...(result.data.items ?? [])]), totalResults: result.data.itemCount, mediaType: "MIXED" }) });
	}
	if (request.kind === "collection") {
		const result = await providers.collection.getCollection(request.tmdbId, { signal });
		if (!result?.ok) return result;
		return Object.freeze({ ok: true, data: Object.freeze({
			results: Object.freeze([...(result.data.containedTitles ?? [])]),
			totalResults: result.data.movieCount ?? result.data.containedTitles?.length ?? 0,
			mediaType: "MOVIE",
		}) });
	}
	if (request.kind === "people") {
		const result = await providers.people.getPerson(request.tmdbId, { signal });
		if (!result?.ok) return result;
		const preview = buildPeopleTitlePreview(result.data, {
			combinations: [request.combinationId],
			sortOptionId: request.sortOptionId,
			limit: 10,
			mediaType: request.mediaType,
		});
		return preview.ok
			? Object.freeze({ ok: true, data: Object.freeze({ results: preview.items, totalResults: preview.totalResults, mediaType: preview.mediaType }) })
			: Object.freeze({ ok: false, error: Object.freeze({ kind: "invalid-response", message: preview.errors[0]?.message ?? "This People preview could not be prepared.", retryable: false }) });
	}
	if (request.kind === "studio") return providers.studio.getStudioPreview(request.tmdbId, { mediaType: request.mediaType, sortBy: request.sortBy, signal });
	if (request.kind === "network") return providers.network.getNetworkPreview(request.tmdbId, { sortBy: request.sortBy, signal });
	if (request.kind === "streaming") return providers.streaming.getStreamingPreview(request.sourceNode, { signal });
	if (request.kind === "genre") return providers.genre.getGenrePreview(request.sourceDraft, { signal });
	if (request.kind === "decade") return providers.decade.getDecadePreview(request.sourceDraft, { signal });
	return failure("This source type cannot be previewed.");
}
